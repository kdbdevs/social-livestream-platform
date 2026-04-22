import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ContentCard,
  MaterialIcon,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "../../components/layout.js";
import { apiRequest, ApiError } from "../../lib/api.js";
import { useSession } from "../../state/session.js";

type ConversationParticipant = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  bio: string | null;
};

type ConversationThread = {
  id: string;
  participant: ConversationParticipant;
  lastMessage: {
    id: string;
    senderId: string;
    message: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DirectMessage = {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
    role: "VIEWER" | "HOST" | "ADMIN";
  };
  message: string;
  createdAt: string;
};

type FollowedUserSuggestion = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  bio: string | null;
};

export function MessagesPage() {
  const { accessToken, user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const autoOpenedUserIdRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [followedSuggestions, setFollowedSuggestions] = useState<FollowedUserSuggestion[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationParticipant[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [sendNotice, setSendNotice] = useState("");

  const composeTargetUserId = searchParams.get("user");
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  async function loadConversations(signal?: AbortSignal) {
    if (!accessToken) {
      setIsLoadingConversations(false);
      return;
    }

    setConversationError("");
    setIsLoadingConversations(true);

    try {
      const response = await apiRequest<{ conversations: ConversationThread[] }>("/messages/conversations", {
        token: accessToken,
        signal,
      });

      setConversations(response.conversations);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setConversationError(resolveErrorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function loadFollowedSuggestions(signal?: AbortSignal) {
    if (!accessToken) {
      return;
    }

    try {
      const response = await apiRequest<{ users: FollowedUserSuggestion[] }>("/users/me/following", {
        token: accessToken,
        signal,
      });

      setFollowedSuggestions(response.users.slice(0, 6));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setFollowedSuggestions([]);
    }
  }

  async function loadMessages(conversationId: string, signal?: AbortSignal) {
    if (!accessToken || !conversationId) {
      return;
    }

    setMessageError("");
    setIsLoadingMessages(true);

    try {
      const response = await apiRequest<{ conversation: ConversationThread; messages: DirectMessage[] }>(
        `/messages/conversations/${conversationId}/messages?limit=60`,
        {
          token: accessToken,
          signal,
        },
      );

      setMessages(response.messages);
      setConversations((current) => upsertConversationThread(current, response.conversation));

      if (response.conversation.unreadCount > 0) {
        await apiRequest(`/messages/conversations/${conversationId}/read`, {
          method: "POST",
          token: accessToken,
        });

        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                }
              : conversation,
          ),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessageError(resolveErrorMessage(error));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function startConversation(participantUserId: string) {
    if (!accessToken) {
      return;
    }

    setConversationError("");
    setIsStartingConversation(true);

    try {
      const response = await apiRequest<{ conversation: ConversationThread }>("/messages/conversations", {
        method: "POST",
        token: accessToken,
        body: {
          participantUserId,
        },
      });

      setActiveConversationId(response.conversation.id);
      setConversations((current) => upsertConversationThread(current, response.conversation));
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      setSendNotice("");
      await loadMessages(response.conversation.id);
      void loadConversations();
    } catch (error) {
      setConversationError(resolveErrorMessage(error));
    } finally {
      setIsStartingConversation(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !activeConversationId) {
      return;
    }

    const nextMessage = composer.trim();

    if (!nextMessage) {
      return;
    }

    setMessageError("");
    setSendNotice("");
    setIsSendingMessage(true);

    try {
      const response = await apiRequest<{ message: DirectMessage }>(`/messages/conversations/${activeConversationId}/messages`, {
        method: "POST",
        token: accessToken,
        body: {
          message: nextMessage,
        },
      });

      setComposer("");
      setMessages((current) => [...current, response.message]);
      setConversations((current) =>
        sortConversationThreads(
          current.map((conversation) =>
            conversation.id === activeConversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                  lastMessage: {
                    id: response.message.id,
                    senderId: response.message.sender.id,
                    message: response.message.message,
                    createdAt: response.message.createdAt,
                  },
                  lastMessageAt: response.message.createdAt,
                  updatedAt: response.message.createdAt,
                }
              : conversation,
          ),
        ),
      );
    } catch (error) {
      setMessageError(resolveErrorMessage(error));
    } finally {
      setIsSendingMessage(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void loadConversations(controller.signal);
    void loadFollowedSuggestions(controller.signal);

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadConversations();
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return undefined;
    }

    const controller = new AbortController();
    void loadMessages(activeConversationId, controller.signal);

    const intervalId = window.setInterval(() => {
      void loadMessages(activeConversationId);
    }, 5000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [activeConversationId, accessToken]);

  useEffect(() => {
    if (!conversations.length || activeConversationId) {
      return;
    }

    setActiveConversationId(conversations[0]?.id ?? "");
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!composeTargetUserId || !accessToken) {
      return;
    }

    if (autoOpenedUserIdRef.current === composeTargetUserId) {
      return;
    }

    autoOpenedUserIdRef.current = composeTargetUserId;

    const existingConversation = conversations.find((conversation) => conversation.participant.id === composeTargetUserId);

    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("user");
      setSearchParams(nextParams, { replace: true });
      return;
    }

    void startConversation(composeTargetUserId).finally(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("user");
      setSearchParams(nextParams, { replace: true });
    });
  }, [accessToken, composeTargetUserId, conversations, searchParams, setSearchParams]);

  useEffect(() => {
    const container = messageScrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchError("");
      setIsSearchingUsers(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingUsers(true);
      setSearchError("");

      try {
        const response = await apiRequest<{ users: ConversationParticipant[] }>(
          `/messages/users?query=${encodeURIComponent(trimmedQuery)}&limit=8`,
          {
            token: accessToken,
            signal: controller.signal,
          },
        );

        setSearchResults(response.users);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSearchError(resolveErrorMessage(error));
      } finally {
        setIsSearchingUsers(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, searchQuery]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Inbox"
        title="Private Messages"
        description="Chat pribadi sekarang benar-benar didukung backend. Kamu bisa mulai percakapan satu lawan satu, membuka thread, dan mengirim pesan antar user."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => void loadConversations()}>
              Refresh Inbox
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => setSearchQuery("")}>
              New Chat
            </PrimaryButton>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MessageStatCard
          icon="mail"
          title="Active Threads"
          value={isLoadingConversations ? "..." : String(conversations.length)}
          meta="Jumlah percakapan pribadi yang sudah aktif di akun ini."
        />
        <MessageStatCard
          icon="mark_email_unread"
          title="Unread Messages"
          value={isLoadingConversations ? "..." : String(unreadTotal)}
          meta="Pesan baru dari lawan bicara yang belum kamu buka."
        />
        <MessageStatCard
          icon="favorite"
          title="Quick Start"
          value={String(followedSuggestions.length)}
          meta="Akun yang kamu follow dan siap dipakai mulai chat dengan satu klik."
        />
      </section>

      {conversationError ? (
        <InlineNotice tone="error" message={conversationError} />
      ) : null}

      <ContentCard className="overflow-hidden p-0">
        <div className="grid min-h-[760px] gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="border-b border-[rgb(64_72_93_/_0.18)] bg-[rgba(11,21,42,0.9)] xl:border-b-0 xl:border-r">
            <div className="border-b border-[rgb(64_72_93_/_0.18)] px-5 py-5">
              <SectionHeader
                title="Inbox Threads"
                description={user ? `Masuk sebagai ${user.handle}. Pilih thread atau cari user baru untuk memulai chat.` : "Pilih thread atau mulai chat baru."}
              />

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                    Search User
                  </span>
                  <div className="flex items-center gap-3 rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container px-4 py-3">
                    <MaterialIcon name="person_search" className="text-[20px] text-primary" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari username atau email..."
                      className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    />
                  </div>
                </label>

                {searchError ? <InlineNotice tone="error" message={searchError} compact /> : null}

                {isSearchingUsers ? (
                  <div className="rounded-2xl border border-[rgb(64_72_93_/_0.18)] bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                    Mencari user...
                  </div>
                ) : searchQuery.trim().length >= 2 ? (
                  searchResults.length ? (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <SearchResultRow
                          key={result.id}
                          participant={result}
                          onSelect={() => void startConversation(result.id)}
                          disabled={isStartingConversation}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[rgb(64_72_93_/_0.22)] bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                      Tidak ada user yang cocok dengan pencarian ini.
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Quick Start From Following</p>
                    {followedSuggestions.length ? (
                      followedSuggestions.map((participant) => (
                        <SearchResultRow
                          key={participant.id}
                          participant={participant}
                          onSelect={() => void startConversation(participant.id)}
                          disabled={isStartingConversation}
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[rgb(64_72_93_/_0.22)] bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
                        Belum ada suggestion. Kamu tetap bisa cari user lain lewat kolom search di atas.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="stealth-scrollbar max-h-[420px] space-y-2 overflow-y-auto px-3 py-3 xl:max-h-[unset] xl:min-h-[420px] xl:flex-1">
              {isLoadingConversations ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-[rgb(64_72_93_/_0.18)] bg-surface-container-high p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-surface-container" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-28 rounded bg-surface-container" />
                        <div className="h-3 w-40 rounded bg-surface-container" />
                      </div>
                    </div>
                  </div>
                ))
              ) : conversations.length ? (
                conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    currentUserId={user?.id ?? ""}
                    onSelect={() => {
                      setActiveConversationId(conversation.id);
                      setSendNotice("");
                    }}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[rgb(64_72_93_/_0.22)] bg-surface-container px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-on-surface">Belum ada thread pribadi</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Cari user di atas atau mulai dari akun yang kamu follow untuk membuka percakapan pertama.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[520px] flex-col">
            {activeConversation ? (
              <>
                <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(16,27,53,0.94),rgba(9,18,37,0.88))] px-5 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <MessageAvatar name={activeConversation.participant.username?.trim() || activeConversation.participant.id.slice(0, 6)} avatarUrl={activeConversation.participant.avatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-on-surface">
                          {activeConversation.participant.username?.trim() || `user-${activeConversation.participant.id.slice(0, 6)}`}
                        </p>
                        <p className="mt-1 truncate text-sm text-on-surface-variant">
                          {activeConversation.participant.bio?.trim() || `Role ${activeConversation.participant.role.toLowerCase()} siap diajak chat privat.`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={() => void loadMessages(activeConversation.id)}>
                        Reload Thread
                      </SecondaryButton>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface-variant">
                        <MaterialIcon name="mark_chat_read" className="text-[18px]" />
                        Private Chat
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={messageScrollRef} className="stealth-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  {isLoadingMessages ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="max-w-[78%] rounded-3xl bg-surface-container p-4" />
                    ))
                  ) : messages.length ? (
                    messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.sender.id === user?.id}
                      />
                    ))
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-md rounded-3xl border border-dashed border-[rgb(64_72_93_/_0.22)] bg-surface-container px-6 py-8 text-center">
                        <p className="text-sm font-semibold text-on-surface">Thread ini belum punya pesan</p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Kirim pesan pertama untuk memulai percakapan pribadi dengan user ini.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[rgb(64_72_93_/_0.18)] bg-surface-container-high px-5 py-4">
                  {messageError ? <InlineNotice tone="error" message={messageError} compact /> : null}
                  {sendNotice ? <InlineNotice tone="success" message={sendNotice} compact /> : null}
                  <form onSubmit={handleSendMessage} className="mt-3">
                    <div className="flex flex-col gap-3 rounded-3xl border border-[rgb(64_72_93_/_0.22)] bg-background p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] md:flex-row md:items-end">
                      <textarea
                        rows={2}
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        placeholder="Tulis pesan pribadi..."
                        className="min-h-[72px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                      />
                      <PrimaryButton type="submit" className="min-w-[132px] px-5 py-3" disabled={isSendingMessage || !composer.trim()}>
                        {isSendingMessage ? "Sending..." : "Send Message"}
                      </PrimaryButton>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex min-h-[520px] flex-1 items-center justify-center px-6 py-10">
                <div className="max-w-lg rounded-[28px] border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-8 text-center shadow-[0_24px_80px_rgba(2,8,24,0.22)]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
                    <MaterialIcon name="chat" className="text-[30px]" />
                  </div>
                  <h2 className="mt-5 font-display text-2xl font-bold text-on-surface">Pilih thread atau mulai chat baru</h2>
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    Sidebar inbox di kiri menampilkan semua percakapan pribadi kamu. Kamu juga bisa cari user baru untuk membuka DM satu lawan satu.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </ContentCard>
    </PageContainer>
  );
}

function MessageStatCard({
  icon,
  title,
  value,
  meta,
}: {
  icon: string;
  title: string;
  value: string;
  meta: string;
}) {
  return (
    <ContentCard className="bg-surface-container-low">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-[22px]" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </ContentCard>
  );
}

function SearchResultRow({
  participant,
  onSelect,
  disabled,
}: {
  participant: ConversationParticipant | FollowedUserSuggestion;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const displayName = participant.username?.trim() || `user-${participant.id.slice(0, 6)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-2xl border border-[rgb(64_72_93_/_0.18)] bg-surface-container px-4 py-3 text-left transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
    >
      <MessageAvatar name={displayName} avatarUrl={participant.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
        <p className="truncate text-xs text-on-surface-variant">
          {participant.bio?.trim() || `Start private chat with ${displayName}.`}
        </p>
      </div>
      <MaterialIcon name="chevron_right" className="text-[20px] text-on-surface-variant" />
    </button>
  );
}

function ConversationRow({
  conversation,
  isActive,
  currentUserId,
  onSelect,
}: {
  conversation: ConversationThread;
  isActive: boolean;
  currentUserId: string;
  onSelect: () => void;
}) {
  const displayName = conversation.participant.username?.trim() || `user-${conversation.participant.id.slice(0, 6)}`;
  const sentByYou = conversation.lastMessage?.senderId === currentUserId;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        isActive
          ? "border-[rgb(186_158_255_/_0.35)] bg-[rgba(186,158,255,0.12)] shadow-[0_18px_40px_rgba(132,85,239,0.14)]"
          : "border-[rgb(64_72_93_/_0.18)] bg-surface-container-high hover:bg-surface-container-highest"
      }`}
    >
      <div className="flex items-start gap-3">
        <MessageAvatar name={displayName} avatarUrl={conversation.participant.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-on-surface">{displayName}</p>
            <span className="shrink-0 text-[11px] text-on-surface-variant">
              {conversation.lastMessageAt ? formatThreadTime(conversation.lastMessageAt) : "New"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
            {conversation.lastMessage
              ? `${sentByYou ? "You: " : ""}${conversation.lastMessage.message}`
              : "Belum ada pesan. Thread siap dipakai untuk chat pribadi."}
          </p>
          {conversation.unreadCount > 0 ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-[rgb(186_158_255_/_0.26)] bg-[rgba(186,158,255,0.12)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {conversation.unreadCount} unread
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: DirectMessage;
  isOwn: boolean;
}) {
  const displayName = message.sender.username?.trim() || `user-${message.sender.id.slice(0, 6)}`;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-[28px] px-4 py-3 shadow-[0_14px_36px_rgba(2,8,24,0.14)] ${
          isOwn
            ? "bg-[linear-gradient(135deg,#ba9eff_0%,#8455ef_100%)] text-on-primary-fixed"
            : "border border-[rgb(64_72_93_/_0.18)] bg-surface-container-high text-on-surface"
        }`}
      >
        <div className="flex items-center gap-2">
          <p className={`text-xs font-semibold ${isOwn ? "text-[rgba(0,0,0,0.7)]" : "text-primary"}`}>
            {isOwn ? "You" : displayName}
          </p>
          <span className={`text-[11px] ${isOwn ? "text-[rgba(0,0,0,0.6)]" : "text-on-surface-variant"}`}>
            {formatThreadTime(message.createdAt)}
          </span>
        </div>
        <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${isOwn ? "text-[rgba(0,0,0,0.88)]" : "text-on-surface-variant"}`}>
          {message.message}
        </p>
      </div>
    </div>
  );
}

function InlineNotice({
  tone,
  message,
  compact = false,
}: {
  tone: "error" | "success";
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.2)] text-on-error-container"
          : "border-[rgb(105_246_184_/_0.28)] bg-[rgb(105_246_184_/_0.12)] text-tertiary"
      } ${compact ? "mt-0" : ""}`}
    >
      {message}
    </div>
  );
}

function MessageAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const className = size === "sm" ? "h-11 w-11 text-xs" : "h-14 w-14 text-sm";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${className} rounded-full border border-[rgb(186_158_255_/_0.26)] object-cover`} />;
  }

  return (
    <div className={`${className} flex items-center justify-center rounded-full border border-[rgb(186_158_255_/_0.26)] bg-surface-container-high font-bold text-on-surface`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function upsertConversationThread(current: ConversationThread[], nextConversation: ConversationThread) {
  const existingIndex = current.findIndex((conversation) => conversation.id === nextConversation.id);

  if (existingIndex === -1) {
    return sortConversationThreads([nextConversation, ...current]);
  }

  return sortConversationThreads(
    current.map((conversation) => (conversation.id === nextConversation.id ? nextConversation : conversation)),
  );
}

function sortConversationThreads(conversations: ConversationThread[]) {
  return [...conversations].sort((left, right) => {
    const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : new Date(left.updatedAt).getTime();
    const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

function formatThreadTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Gagal memuat private messages dari backend.";
}
