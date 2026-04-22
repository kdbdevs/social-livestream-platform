import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ContentCard,
  MaterialIcon,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
} from "../../components/layout.js";
import { loadHlsLibrary } from "../../components/media-player.js";
import { apiRequest, ApiError } from "../../lib/api.js";
import { useSession, type SessionUser } from "../../state/session.js";

type RoomStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED";

type RoomView = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  category: string | null;
  status: RoomStatus;
  chatEnabled: boolean;
  giftEnabled: boolean;
  playbackUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChatMessageView = {
  id: string;
  roomId: string;
  sender: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
    role: string;
  };
  message: string;
  createdAt: string;
};

type DisplayMessage =
  | {
      id: string;
      kind: "chat";
      sender: {
        id: string;
        username: string;
        avatarUrl: string | null;
        role: string;
      };
      message: string;
      createdAt: string;
      pending?: boolean;
    }
  | {
      id: string;
      kind: "gift";
      sender: {
        id: string;
        username: string;
        avatarUrl: string | null;
        role: string;
      };
      giftName: string;
      quantity: number;
      emoji: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: "system";
      label: string;
      createdAt: string;
    };

type GiftTier = "SMALL" | "BIG" | "FULLSCREEN";

type GiftCatalogItem = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  tier: GiftTier;
};

type FeedEvent = {
  id: string;
  sender: string;
  giftName: string;
  emoji: string;
  quantity: number;
  accent: "primary" | "tertiary";
  createdAt: number;
};

type LikeBurst = {
  id: string;
  xOffset: number;
  scale: number;
};

type HlsInstance = {
  attachMedia: (media: HTMLVideoElement) => void;
  loadSource: (src: string) => void;
  destroy: () => void;
};

const CHAT_POLL_MS = 4_000;
const ROOM_POLL_MS = 10_000;
const MAX_LIKES_PER_SECOND = 7;
const DEFAULT_WALLET_BALANCE = 1_250;

const giftCatalog: GiftCatalogItem[] = [
  { id: "heart", name: "Heart Burst", emoji: "❤️", price: 10, tier: "SMALL" },
  { id: "rocket", name: "Turbo Rocket", emoji: "🚀", price: 50, tier: "BIG" },
  { id: "crown", name: "Pulse Crown", emoji: "👑", price: 120, tier: "BIG" },
  { id: "dragon", name: "Neon Dragon", emoji: "🐉", price: 1_000, tier: "FULLSCREEN" },
];

export function RoomWatchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken, isAuthenticated, user } = useSession();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [backendMessages, setBackendMessages] = useState<ChatMessageView[]>([]);
  const [localTimeline, setLocalTimeline] = useState<DisplayMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState(giftCatalog[0]?.id ?? "heart");
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [walletBalance, setWalletBalance] = useState(DEFAULT_WALLET_BALANCE);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [likeBursts, setLikeBursts] = useState<LikeBurst[]>([]);
  const [bigQueue, setBigQueue] = useState<FeedEvent[]>([]);
  const [fullscreenQueue, setFullscreenQueue] = useState<FeedEvent[]>([]);
  const [activeBigGift, setActiveBigGift] = useState<FeedEvent | null>(null);
  const [activeFullscreenGift, setActiveFullscreenGift] = useState<FeedEvent | null>(null);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const likeTimestampRef = useRef<number[]>([]);

  useEffect(() => {
    if (!id) {
      setError("Room ID tidak valid.");
      setIsLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadRoom(showRefreshState: boolean) {
      if (!active) {
        return;
      }

      if (showRefreshState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await apiRequest<{ room: RoomView }>(`/rooms/${id}`, {
          token: accessToken,
          signal: controller.signal,
        });

        if (!active) {
          return;
        }

        setRoom(response.room);
        setError("");
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (!active) {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        if (active) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadRoom(false);

    const interval = window.setInterval(() => {
      void loadRoom(true);
    }, ROOM_POLL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [accessToken, id, refreshSeed]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function loadChat() {
      try {
        const response = await apiRequest<{ messages: ChatMessageView[] }>(`/rooms/${id}/chat?limit=40`, {
          signal: controller.signal,
        });

        if (!active) {
          return;
        }

        setBackendMessages(response.messages);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (!active) {
          return;
        }

        setNotice(resolveErrorMessage(loadError));
      }
    }

    void loadChat();

    const interval = window.setInterval(() => {
      void loadChat();
    }, CHAT_POLL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    if (!id || !accessToken) {
      return;
    }

    const controller = new AbortController();

    void apiRequest<{ roomId: string; watchedAt: string }>(`/rooms/${id}/view`, {
      method: "POST",
      token: accessToken,
      signal: controller.signal,
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    });

    return () => {
      controller.abort();
    };
  }, [accessToken, id]);

  useEffect(() => {
    if (!id || !accessToken) {
      setIsSaved(false);
      return;
    }

    const controller = new AbortController();

    void apiRequest<{ roomId: string; saved: boolean }>(`/rooms/${id}/save`, {
      token: accessToken,
      signal: controller.signal,
    })
      .then((response) => {
        setIsSaved(response.saved);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, id]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 3_500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setFeedEvents((current) => current.filter((event) => now - event.createdAt < 5_000));
      setLikeBursts((current) => current.filter((_, index) => index < 12));
    }, 400);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (activeBigGift || !bigQueue.length) {
      return;
    }

    const next = bigQueue[0];
    setActiveBigGift(next);
    setBigQueue((current) => current.slice(1));

    const timeout = window.setTimeout(() => {
      setActiveBigGift((current) => (current?.id === next.id ? null : current));
    }, 2_900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeBigGift, bigQueue]);

  useEffect(() => {
    if (activeFullscreenGift || !fullscreenQueue.length) {
      return;
    }

    const next = fullscreenQueue[0];
    setActiveFullscreenGift(next);
    setFullscreenQueue((current) => current.slice(1));

    const timeout = window.setTimeout(() => {
      setActiveFullscreenGift((current) => (current?.id === next.id ? null : current));
    }, 5_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeFullscreenGift, fullscreenQueue]);

  const displayedMessages = useMemo<DisplayMessage[]>(() => {
    const mappedBackendMessages = backendMessages.map<DisplayMessage>((message) => ({
      id: message.id,
      kind: "chat",
      sender: {
        id: message.sender.id,
        username: message.sender.username?.trim() || `viewer_${message.sender.id.slice(0, 4)}`,
        avatarUrl: message.sender.avatarUrl,
        role: message.sender.role,
      },
      message: message.message,
      createdAt: message.createdAt,
    }));

    return [...mappedBackendMessages, ...localTimeline].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }, [backendMessages, localTimeline]);

  useEffect(() => {
    const container = chatScrollRef.current;

    if (!container) {
      return;
    }

    const previousCount = previousMessageCountRef.current;
    const nextCount = displayedMessages.length;

    if (nextCount === previousCount) {
      return;
    }

    previousMessageCountRef.current = nextCount;

    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
      setNewMessagesCount(0);
      return;
    }

    if (nextCount > previousCount) {
      setNewMessagesCount((current) => current + (nextCount - previousCount));
    }
  }, [displayedMessages]);

  const selectedGift = giftCatalog.find((gift) => gift.id === selectedGiftId) ?? giftCatalog[0];
  const hostIdentity = buildHostIdentity(room, user);
  const pageEyebrow = room?.status === "LIVE" ? "Live Playback" : "Room Watch";
  const playerMode = getPlayerMode(room);

  function handleScrollChat() {
    const container = chatScrollRef.current;

    if (!container) {
      return;
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 24;
    isAtBottomRef.current = nearBottom;

    if (nearBottom) {
      setNewMessagesCount(0);
    }
  }

  function jumpToLatestMessages() {
    const container = chatScrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    isAtBottomRef.current = true;
    setNewMessagesCount(0);
  }

  function handleFollow() {
    if (!isAuthenticated || !user) {
      setNotice("Login dulu untuk follow host ini.");
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    appendSystemMessage(nextState ? "Kamu mengikuti host ini." : "Kamu berhenti mengikuti host ini.");
  }

  function handleLike() {
    const now = Date.now();
    likeTimestampRef.current = likeTimestampRef.current.filter((timestamp) => now - timestamp < 1_000);

    if (likeTimestampRef.current.length >= MAX_LIKES_PER_SECOND) {
      return;
    }

    likeTimestampRef.current.push(now);

    const burstId = crypto.randomUUID();
    const burst: LikeBurst = {
      id: burstId,
      xOffset: Math.random() * 72 - 36,
      scale: 0.86 + Math.random() * 0.5,
    };

    setLikeBursts((current) => [...current.slice(-10), burst]);

    window.setTimeout(() => {
      setLikeBursts((current) => current.filter((item) => item.id !== burstId));
    }, 1_500);
  }

  async function handleToggleSave() {
    if (!id) {
      return;
    }

    if (!isAuthenticated || !user || !accessToken) {
      setNotice("Login dulu untuk menyimpan room ini.");
      return;
    }

    try {
      const response = await apiRequest<{ roomId: string; saved: boolean }>(`/rooms/${id}/save`, {
        method: isSaved ? "DELETE" : "POST",
        token: accessToken,
      });

      setIsSaved(response.saved);
      setNotice(response.saved ? "Room disimpan ke Saved." : "Room dihapus dari Saved.");
    } catch (saveError) {
      setNotice(resolveErrorMessage(saveError));
    }
  }

  async function handleShare() {
    const roomUrl = typeof window === "undefined" ? "" : window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: room?.title ?? "NEONPULSE room",
          text: "Join this live room on NEONPULSE.",
          url: roomUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(roomUrl);
      setNotice("Link room berhasil disalin.");
    } catch {
      setNotice("Share dibatalkan.");
    }
  }

  function handleSendChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = chatInput.trim();

    if (!message) {
      return;
    }

    if (!isAuthenticated || !user) {
      setNotice("Login dulu untuk ikut chat.");
      return;
    }

    if (!room?.chatEnabled) {
      setNotice("Chat untuk room ini sedang dimatikan.");
      return;
    }

    const nextMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      kind: "chat",
      sender: {
        id: user.id,
        username: user.name,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
      },
      message,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setLocalTimeline((current) => [...current, nextMessage]);
    setChatInput("");
    requestAnimationFrame(() => {
      jumpToLatestMessages();
    });
  }

  function handleSendGift() {
    if (!selectedGift) {
      return;
    }

    if (!room?.giftEnabled) {
      setNotice("Gift sedang dimatikan untuk room ini.");
      return;
    }

    if (!isAuthenticated || !user) {
      setNotice("Login dulu untuk mengirim gift.");
      return;
    }

    const totalCost = selectedGift.price * giftQuantity;

    if (totalCost > walletBalance) {
      setNotice("Saldo tidak cukup. Top up wallet untuk kirim gift ini.");
      return;
    }

    setWalletBalance((current) => current - totalCost);

    const eventId = crypto.randomUUID();
    const giftEvent: FeedEvent = {
      id: eventId,
      sender: user.name,
      giftName: selectedGift.name,
      emoji: selectedGift.emoji,
      quantity: giftQuantity,
      accent: selectedGift.tier === "SMALL" ? "tertiary" : "primary",
      createdAt: Date.now(),
    };

    setFeedEvents((current) => mergeFeedEvents(current, giftEvent));

    if (selectedGift.tier === "BIG") {
      setBigQueue((current) => [...current, giftEvent]);
    }

    if (selectedGift.tier === "FULLSCREEN") {
      setFullscreenQueue((current) => [...current, giftEvent]);
    }

    setLocalTimeline((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: "gift",
        sender: {
          id: user.id,
          username: user.name,
          avatarUrl: user.avatarUrl ?? null,
          role: user.role,
        },
        giftName: selectedGift.name,
        quantity: giftQuantity,
        emoji: selectedGift.emoji,
        createdAt: new Date().toISOString(),
      },
    ]);
    setGiftQuantity(1);
    setIsGiftTrayOpen(false);
    setNotice(`${selectedGift.name} terkirim.`);
  }

  function appendSystemMessage(label: string) {
    setLocalTimeline((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: "system",
        label,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">{pageEyebrow}</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">
            {room?.title ?? "Loading room playback"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Halaman ini memuat detail room dan playback stream langsung dari backend, lalu membungkusnya dengan
            layer interaktif ala `stitch/room_watch` tanpa mengubah AppShell global.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryButton type="button" onClick={() => navigate("/")}>
            Back To Home
          </SecondaryButton>
          <PrimaryButton type="button" onClick={() => setRefreshSeed((current) => current + 1)} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh Room"}
          </PrimaryButton>
        </div>
      </div>

      {error ? (
        <ContentCard className="border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] text-on-error-container">
          <div className="flex items-start gap-3">
            <MaterialIcon name="error" className="mt-0.5 text-error" />
            <div>
              <p className="text-sm font-semibold">Room playback gagal dimuat</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </ContentCard>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-[rgb(186_158_255_/_0.24)] bg-[rgb(186_158_255_/_0.1)] px-4 py-3 text-sm text-on-surface">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.78fr)]">
        <div className="space-y-5">
          <RoomPlaybackPanel
            room={room}
            isLoading={isLoading}
            hostIdentity={hostIdentity}
            isFollowing={isFollowing}
            isSaved={isSaved}
            playerMode={playerMode}
            onFollow={handleFollow}
            onSave={handleToggleSave}
            onLike={handleLike}
            onGift={() => setIsGiftTrayOpen(true)}
            onShare={() => {
              void handleShare();
            }}
            onRetry={() => setRefreshSeed((current) => current + 1)}
            feedEvents={feedEvents}
            likeBursts={likeBursts}
            activeBigGift={activeBigGift}
            activeFullscreenGift={activeFullscreenGift}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <PulseInfoCard
              icon="visibility"
              title="Live Audience"
              value={room ? formatViewerCount(room.viewerCount) : "--"}
              meta="Realtime viewer count dari backend room."
            />
            <PulseInfoCard
              icon="chat"
              title="Chat State"
              value={room?.chatEnabled ? "Open" : "Paused"}
              meta="Composer tetap sticky dan history chat dipoll dari API."
            />
            <PulseInfoCard
              icon="redeem"
              title="Gift State"
              value={room?.giftEnabled ? "Enabled" : "Disabled"}
              meta="Gift tray siap dipakai tanpa menutupi video layer."
            />
          </div>
        </div>

        <ChatPanel
          room={room}
          user={user}
          messages={displayedMessages}
          input={chatInput}
          newMessagesCount={newMessagesCount}
          scrollRef={chatScrollRef}
          onInputChange={setChatInput}
          onSubmit={handleSendChat}
          onGift={() => setIsGiftTrayOpen(true)}
          onJumpToLatest={jumpToLatestMessages}
          onScroll={handleScrollChat}
          walletBalance={walletBalance}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <ContentCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Room Overview</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-on-surface">
                {room?.title ?? "Waiting for room data"}
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  room?.status === "LIVE" ? "bg-error" : room?.status === "PUBLISHED" ? "bg-primary" : "bg-outline"
                }`}
              />
              Backend room state {room?.status ?? "Unknown"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <RoomMetaRow
              label="Category"
              value={room?.category || "General livestream"}
              icon="category"
            />
            <RoomMetaRow
              label="Playback"
              value={room?.playbackUrl ? "Connected to backend HLS" : "Awaiting active stream source"}
              icon="live_tv"
            />
            <RoomMetaRow
              label="Started"
              value={formatRelativeDate(room?.startedAt)}
              icon="schedule"
            />
            <RoomMetaRow
              label="Host"
              value={hostIdentity.username}
              icon="person"
            />
          </div>

          <p className="mt-5 text-sm leading-7 text-on-surface-variant">
            {room?.description ||
              "Deskripsi room belum tersedia. Setelah host aktif dan stream berjalan dari OBS, layar playback akan menampilkan source asli beserta lapisan chat, like, dan gift overlay."}
          </p>
        </ContentCard>

        <ContentCard>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Interaction Rules</p>
          <div className="mt-5 space-y-4">
            <GuidelineRow
              title="Video stays primary"
              description="Overlay gift, host chip, dan quick actions memakai glass layer agar tidak menutup fokus video."
            />
            <GuidelineRow
              title="Chaos stays organized"
              description="Small gift digabung sebagai combo, big gift diantrikan singkat, dan fullscreen gift tidak pernah dibuang."
            />
            <GuidelineRow
              title="Chat remains readable"
              description="Saat user scroll ke atas, indikator new messages muncul tanpa memaksa panel lompat ke bawah."
            />
            <GuidelineRow
              title="Responsive behavior"
              description="Desktop memakai split 70/30, tablet turun ke stack, dan mobile tetap menyisakan overlay action di area player."
            />
          </div>
        </ContentCard>
      </section>

      <GiftTray
        isOpen={isGiftTrayOpen}
        walletBalance={walletBalance}
        selectedGiftId={selectedGiftId}
        quantity={giftQuantity}
        onClose={() => setIsGiftTrayOpen(false)}
        onSelectGift={setSelectedGiftId}
        onQuantityChange={setGiftQuantity}
        onSend={handleSendGift}
      />
    </PageContainer>
  );
}

function RoomPlaybackPanel({
  room,
  isLoading,
  hostIdentity,
  isFollowing,
  isSaved,
  playerMode,
  onFollow,
  onSave,
  onLike,
  onGift,
  onShare,
  onRetry,
  feedEvents,
  likeBursts,
  activeBigGift,
  activeFullscreenGift,
}: {
  room: RoomView | null;
  isLoading: boolean;
  hostIdentity: ReturnType<typeof buildHostIdentity>;
  isFollowing: boolean;
  isSaved: boolean;
  playerMode: ReturnType<typeof getPlayerMode>;
  onFollow: () => void;
  onSave: () => void;
  onLike: () => void;
  onGift: () => void;
  onShare: () => void;
  onRetry: () => void;
  feedEvents: FeedEvent[];
  likeBursts: LikeBurst[];
  activeBigGift: FeedEvent | null;
  activeFullscreenGift: FeedEvent | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackError, setPlaybackError] = useState("");
  const [videoState, setVideoState] = useState<"idle" | "loading" | "playing" | "buffering">("idle");

  useEffect(() => {
    const video = videoRef.current;
    const src = room?.playbackUrl;

    if (!video || !src || playerMode.kind !== "playing") {
      setVideoState("idle");
      setPlaybackError("");
      return;
    }

    let hls: HlsInstance | null = null;
    let cancelled = false;

    setVideoState("loading");
    setPlaybackError("");

    const handleLoadStart = () => setVideoState("loading");
    const handlePlaying = () => setVideoState("playing");
    const handleWaiting = () => setVideoState("buffering");
    const handleCanPlay = () => setVideoState("playing");
    const handleError = () => setPlaybackError("Player gagal memuat stream ini.");

    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      void video.play().catch(() => {
        setVideoState("playing");
      });
    } else {
      void loadHlsLibrary().then((Hls) => {
        if (cancelled) {
          return;
        }

        if (!Hls || !Hls.isSupported()) {
          setPlaybackError("Browser ini belum mendukung playback HLS.");
          return;
        }

        hls = new Hls();
        hls.attachMedia(video);
        hls.loadSource(src);
      });
    }

    return () => {
      cancelled = true;
      video.pause();
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);

      if (hls) {
        hls.destroy();
      }

      video.removeAttribute("src");
      video.load();
    };
  }, [playerMode.kind, room?.playbackUrl]);

  return (
    <section className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.28)] bg-surface-container shadow-[0_24px_80px_rgba(2,8,24,0.3)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(186,158,255,0.16),transparent_28%),linear-gradient(135deg,rgba(15,25,48,0.94),rgba(31,43,73,0.86))]" />

        {playerMode.kind === "playing" && room?.playbackUrl ? (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              controls
              poster={room.coverImageUrl ?? undefined}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,14,32,0.5)_0%,rgba(6,14,32,0.06)_24%,rgba(6,14,32,0.56)_100%)]" />
          </>
        ) : null}

        {playerMode.kind === "loading" || isLoading ? <PlayerPlaceholder kind="loading" onRetry={onRetry} /> : null}
        {playerMode.kind === "starting-soon" ? <PlayerPlaceholder kind="starting-soon" onRetry={onRetry} /> : null}
        {playerMode.kind === "ended" ? <PlayerPlaceholder kind="ended" onRetry={onRetry} /> : null}
        {playerMode.kind === "error" ? <PlayerPlaceholder kind="error" onRetry={onRetry} /> : null}

        {playerMode.kind === "playing" ? (
          <>
            <div className="absolute left-4 top-4 z-10 max-w-[min(440px,calc(100%-104px))]">
              <HostChip hostIdentity={hostIdentity} isFollowing={isFollowing} onFollow={onFollow} title={room?.title ?? ""} />
            </div>

            <div className="absolute right-4 top-4 z-10 flex flex-wrap items-center justify-end gap-2">
              <StatusChip room={room} />
            </div>

            <div className="absolute bottom-5 left-4 z-20 flex max-w-[260px] flex-col gap-2 md:max-w-[320px]">
              {feedEvents.slice(-4).reverse().map((event) => (
                <MiniGiftBanner key={event.id} event={event} />
              ))}
            </div>

            <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-3">
              <PlayerActions isSaved={isSaved} onSave={onSave} onLike={onLike} onGift={onGift} onShare={onShare} />
            </div>

            <div className="pointer-events-none absolute bottom-14 right-16 z-20 h-40 w-24 overflow-hidden">
              {likeBursts.map((burst) => (
                <span
                  key={burst.id}
                  className="watch-like-heart absolute bottom-0 left-1/2 text-xl text-error"
                  style={{
                    transform: `translateX(${burst.xOffset}px) scale(${burst.scale})`,
                  }}
                >
                  ♥
                </span>
              ))}
            </div>

            {activeBigGift ? <BigGiftLayer event={activeBigGift} /> : null}
            {activeFullscreenGift ? <FullscreenGiftLayer event={activeFullscreenGift} /> : null}

            {(videoState === "loading" || videoState === "buffering") && !playbackError ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-full border border-[rgb(186_158_255_/_0.28)] bg-[rgba(6,14,32,0.72)] px-4 py-2 text-sm font-semibold text-on-surface shadow-[0_18px_50px_rgba(2,8,24,0.32)] backdrop-blur-xl">
                  {videoState === "buffering" ? "Buffering live stream..." : "Connecting to live playback..."}
                </div>
              </div>
            ) : null}

            {playbackError ? <PlayerPlaceholder kind="error" onRetry={onRetry} message={playbackError} compact /> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function PlayerPlaceholder({
  kind,
  onRetry,
  message,
  compact = false,
}: {
  kind: "loading" | "starting-soon" | "ended" | "error";
  onRetry: () => void;
  message?: string;
  compact?: boolean;
}) {
  const config = {
    loading: {
      icon: "hourglass_top",
      title: "Loading live room",
      description: "Mengambil metadata room dan menyiapkan player untuk playback stream.",
      actionLabel: "Refresh",
    },
    "starting-soon": {
      icon: "schedule",
      title: "Starting soon",
      description: "Room sudah ada, tetapi source live belum aktif atau host belum benar-benar masuk siaran.",
      actionLabel: "Check Again",
    },
    ended: {
      icon: "videocam_off",
      title: "Live has ended",
      description: "Siaran ini sudah selesai. Anda bisa kembali ke Home untuk memilih room live lain.",
      actionLabel: "Refresh",
    },
    error: {
      icon: "error",
      title: "Playback error",
      description: message || "Terjadi masalah saat memuat room playback ini.",
      actionLabel: "Retry",
    },
  }[kind];

  return (
    <div className={`absolute inset-0 z-10 flex items-center justify-center ${compact ? "bg-[rgba(6,14,32,0.4)]" : "bg-transparent"}`}>
      <div className="mx-5 max-w-md rounded-2xl border border-[rgb(64_72_93_/_0.28)] bg-[rgba(6,14,32,0.78)] p-6 text-center shadow-[0_24px_80px_rgba(2,8,24,0.36)] backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
          <MaterialIcon name={config.icon} className="text-3xl" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold text-on-surface">{config.title}</h3>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{config.description}</p>
        <div className="mt-5">
          <SecondaryButton type="button" onClick={onRetry} className="w-full">
            {config.actionLabel}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function HostChip({
  hostIdentity,
  isFollowing,
  onFollow,
  title,
}: {
  hostIdentity: ReturnType<typeof buildHostIdentity>;
  isFollowing: boolean;
  onFollow: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[rgb(64_72_93_/_0.28)] bg-[rgba(15,25,48,0.72)] px-2 py-1.5 pr-2.5 shadow-[0_18px_48px_rgba(2,8,24,0.26)] backdrop-blur-xl">
      <AvatarBadge name={hostIdentity.username} avatarUrl={hostIdentity.avatarUrl} size="xs" />
      <div className="min-w-0 max-w-[110px] md:max-w-[170px]">
        <p className="truncate text-xs font-bold text-on-surface">{hostIdentity.username}</p>
        <p className="truncate text-[10px] text-on-surface-variant">{truncateTitle(title, 20)}</p>
      </div>
      <button
        type="button"
        onClick={onFollow}
        className={`ml-0.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
          isFollowing
            ? "border border-[rgb(64_72_93_/_0.28)] bg-surface-container-high text-on-surface"
            : "primary-button text-on-primary-fixed"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}

function StatusChip({ room }: { room: RoomView | null }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(255_110_132_/_0.18)] bg-[rgba(167,1,56,0.6)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-on-error-container backdrop-blur-xl">
        <span className="h-2.5 w-2.5 rounded-full bg-error animate-pulse" />
        {room?.status === "LIVE" ? "Live" : room?.status ?? "Pending"}
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(64_72_93_/_0.28)] bg-[rgba(15,25,48,0.72)] px-3 py-1.5 text-xs font-semibold text-on-surface backdrop-blur-xl">
        <MaterialIcon name="visibility" className="text-base text-on-surface-variant" />
        {formatViewerCount(room?.viewerCount ?? 0)} viewers
      </div>
    </div>
  );
}

function MiniGiftBanner({ event }: { event: FeedEvent }) {
  const accentClass =
    event.accent === "tertiary"
      ? "border-[rgb(105_246_184_/_0.18)] bg-[rgba(9,19,40,0.76)] text-tertiary"
      : "border-[rgb(186_158_255_/_0.18)] bg-[rgba(15,25,48,0.82)] text-primary";

  return (
    <div className={`watch-feed-banner flex items-center gap-3 rounded-xl border px-3 py-2 shadow-[0_18px_45px_rgba(2,8,24,0.22)] backdrop-blur-xl ${accentClass}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] text-lg">
        {event.emoji}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold">
          {event.sender} <span className="font-medium text-on-surface">sent {event.giftName}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">Combo x{event.quantity}</p>
      </div>
    </div>
  );
}

function BigGiftLayer({ event }: { event: FeedEvent }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-6">
      <div className="watch-big-gift flex min-w-[260px] max-w-lg items-center gap-4 rounded-2xl border border-[rgb(186_158_255_/_0.28)] bg-[rgba(15,25,48,0.78)] px-5 py-4 shadow-[0_30px_90px_rgba(132,85,239,0.24)] backdrop-blur-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(186,158,255,0.12)] text-3xl">
          {event.emoji}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Big Gift</p>
          <p className="mt-1 text-lg font-bold text-on-surface">
            {event.sender} sent {event.giftName}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">Quantity x{event.quantity}</p>
        </div>
      </div>
    </div>
  );
}

function FullscreenGiftLayer({ event }: { event: FeedEvent }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="watch-fullscreen-gift absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(186,158,255,0.22),transparent_42%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-[rgba(255,255,255,0.04)] px-8 py-7 text-center shadow-[0_0_140px_rgba(132,85,239,0.34)] backdrop-blur-sm">
          <div className="text-7xl">{event.emoji}</div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.28em] text-primary">Fullscreen Gift</p>
          <p className="mt-3 font-display text-3xl font-extrabold text-on-surface">{event.giftName}</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {event.sender} lit up the room with x{event.quantity}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayerActions({
  isSaved,
  onSave,
  onLike,
  onGift,
  onShare,
}: {
  isSaved: boolean;
  onSave: () => void;
  onLike: () => void;
  onGift: () => void;
  onShare: () => void;
}) {
  return (
    <>
      <FloatingAction icon={isSaved ? "bookmark_added" : "bookmark"} label={isSaved ? "Unsave" : "Save"} accent="soft" onClick={onSave} />
      <FloatingAction icon="favorite" label="Like" accent="soft" onClick={onLike} />
      <FloatingAction icon="redeem" label="Gift" accent="primary" onClick={onGift} />
      <FloatingAction icon="share" label="Share" accent="soft" onClick={onShare} />
    </>
  );
}

function FloatingAction({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: string;
  label: string;
  accent: "soft" | "primary";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`group inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_16px_40px_rgba(2,8,24,0.28)] transition hover:-translate-y-0.5 ${
        accent === "primary"
          ? "border-[rgb(186_158_255_/_0.24)] bg-[linear-gradient(135deg,#ba9eff_0%,#8455ef_100%)] text-on-primary-fixed"
          : "border-[rgb(64_72_93_/_0.28)] bg-[rgba(15,25,48,0.72)] text-on-surface backdrop-blur-xl"
      }`}
    >
      <MaterialIcon name={icon} className="text-[19px] transition group-hover:scale-110" filled={accent === "primary"} />
    </button>
  );
}

function ChatPanel({
  room,
  user,
  messages,
  input,
  newMessagesCount,
  scrollRef,
  onInputChange,
  onSubmit,
  onGift,
  onJumpToLatest,
  onScroll,
  walletBalance,
}: {
  room: RoomView | null;
  user: SessionUser | null;
  messages: DisplayMessage[];
  input: string;
  newMessagesCount: number;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onGift: () => void;
  onJumpToLatest: () => void;
  onScroll: () => void;
  walletBalance: number;
}) {
  return (
    <section className="flex min-h-[680px] flex-col overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low shadow-[0_24px_80px_rgba(2,8,24,0.24)]">
      <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[rgba(15,25,48,0.72)] px-5 py-4 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Live Chat</p>
          </div>
          <div className="rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
            {messages.length} messages
          </div>
        </div>
        <div className="mt-4 flex gap-5 border-b border-[rgb(64_72_93_/_0.16)] pb-0">
          <button type="button" className="border-b-2 border-primary pb-2 text-sm font-semibold text-primary">
            Live Chat
          </button>
          <button type="button" className="pb-2 text-sm font-semibold text-on-surface-variant">
            Top Fans
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {messages.length ? (
              messages.map((message) => <ChatMessageItem key={message.id} message={message} />)
            ) : (
              <div className="rounded-xl border border-dashed border-[rgb(64_72_93_/_0.24)] bg-surface-container p-5 text-center">
                <p className="text-sm font-semibold text-on-surface">Belum ada chat masuk</p>
                <p className="mt-2 text-sm text-on-surface-variant">
                  History chat dari room ini akan muncul di sini begitu backend mulai mengirim pesan.
                </p>
              </div>
            )}
          </div>
        </div>

        {newMessagesCount ? (
          <button
            type="button"
            onClick={onJumpToLatest}
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[rgb(186_158_255_/_0.24)] bg-[rgba(15,25,48,0.82)] px-4 py-2 text-xs font-bold text-primary shadow-[0_18px_40px_rgba(2,8,24,0.24)] backdrop-blur-xl"
          >
            {newMessagesCount} new messages
          </button>
        ) : null}
      </div>

      <div className="border-t border-[rgb(64_72_93_/_0.18)] bg-surface-container-high px-5 py-4">
        <form onSubmit={onSubmit} className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-background p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex items-end gap-3">
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition hover:text-primary">
              <MaterialIcon name="mood" className="text-xl" />
            </button>
            <textarea
              rows={1}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={room?.chatEnabled ? "Send a message..." : "Chat is disabled for this room"}
              disabled={!room?.chatEnabled}
              className="min-h-[44px] flex-1 resize-none bg-transparent py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!room?.chatEnabled}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MaterialIcon name="send" className="text-xl" filled />
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onGift} className="inline-flex items-center gap-2 font-semibold transition hover:text-primary">
              <MaterialIcon name="redeem" className="text-base" />
              Gift
            </button>
            <span className="inline-flex items-center gap-2">
              <MaterialIcon name="person" className="text-base" />
              {user ? `Chat as ${user.handle}` : "Login to join"}
            </span>
          </div>
          <div>
            Balance: <span className="font-bold text-tertiary">{walletBalance}</span> Gems
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatMessageItem({ message }: { message: DisplayMessage }) {
  if (message.kind === "system") {
    return (
      <div className="rounded-xl border border-[rgb(64_72_93_/_0.18)] bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
        {message.label}
      </div>
    );
  }

  if (message.kind === "gift") {
    return (
      <div className="flex gap-3 rounded-xl border border-[rgb(186_158_255_/_0.18)] bg-[rgba(15,25,48,0.82)] p-3 shadow-[0_12px_32px_rgba(132,85,239,0.08)]">
        <AvatarBadge name={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-bold text-primary">{message.sender.username}</span>
            <span className="text-[10px] text-on-surface-variant">{formatMessageTime(message.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            <span className="mr-2 text-xl">{message.emoji}</span>
            Sent {message.giftName} x{message.quantity}
          </p>
        </div>
      </div>
    );
  }

  const isHighlightedRole = message.sender.role === "ADMIN" || message.sender.role === "HOST";

  return (
    <div className="flex gap-3">
      <AvatarBadge name={message.sender.username} avatarUrl={message.sender.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-bold ${isHighlightedRole ? "text-tertiary" : "text-on-surface"}`}>
            {message.sender.username}
          </span>
          <span className="text-[10px] text-on-surface-variant">{formatMessageTime(message.createdAt)}</span>
          {message.pending ? (
            <span className="rounded-full border border-[rgb(64_72_93_/_0.22)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              local
            </span>
          ) : null}
        </div>
        <p className="mt-1 break-words text-sm leading-6 text-on-surface-variant">{message.message}</p>
      </div>
    </div>
  );
}

function GiftTray({
  isOpen,
  walletBalance,
  selectedGiftId,
  quantity,
  onClose,
  onSelectGift,
  onQuantityChange,
  onSend,
}: {
  isOpen: boolean;
  walletBalance: number;
  selectedGiftId: string;
  quantity: number;
  onClose: () => void;
  onSelectGift: (giftId: string) => void;
  onQuantityChange: (quantity: number) => void;
  onSend: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const selectedGift = giftCatalog.find((gift) => gift.id === selectedGiftId) ?? giftCatalog[0];
  const totalCost = selectedGift.price * quantity;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(6,14,32,0.76)] p-4 backdrop-blur-md md:items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-[rgb(64_72_93_/_0.28)] bg-surface-container shadow-[0_30px_110px_rgba(2,8,24,0.44)]">
        <div className="flex items-center justify-between border-b border-[rgb(64_72_93_/_0.18)] bg-surface-container-highest px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Gift Tray</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-on-surface">Send a gift</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container text-on-surface-variant transition hover:text-on-surface">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {giftCatalog.map((gift) => {
                const isSelected = gift.id === selectedGiftId;

                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => onSelectGift(gift.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-[rgb(186_158_255_/_0.38)] bg-[rgba(186,158,255,0.12)] shadow-[0_20px_40px_rgba(132,85,239,0.18)]"
                        : "border-[rgb(64_72_93_/_0.22)] bg-surface-container-high hover:bg-surface-container-highest"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-4xl">{gift.emoji}</span>
                      <span className="rounded-full border border-[rgb(64_72_93_/_0.22)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                        {gift.tier}
                      </span>
                    </div>
                    <p className="mt-4 font-display text-lg font-bold text-on-surface">{gift.name}</p>
                    <p className="mt-2 text-sm text-tertiary">{gift.price} Gems</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Preview</p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-container p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(186,158,255,0.12)] text-3xl">
                  {selectedGift.emoji}
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-on-surface">{selectedGift.name}</p>
                  <p className="text-sm text-on-surface-variant">{selectedGift.tier} overlay animation</p>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Quantity</span>
              <div className="mt-2 flex items-center gap-2">
                {[1, 5, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onQuantityChange(value)}
                    className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                      quantity === value
                        ? "bg-[rgba(186,158,255,0.16)] text-primary"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    x{value}
                  </button>
                ))}
              </div>
            </label>

            <div className="rounded-2xl bg-surface-container p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Wallet balance</p>
              <p className="mt-2 text-2xl font-bold text-tertiary">{walletBalance} Gems</p>
              <p className="mt-3 text-sm text-on-surface-variant">This send will cost {totalCost} Gems.</p>
            </div>

            <PrimaryButton type="button" onClick={onSend} className="w-full">
              Send Gift
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function PulseInfoCard({
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
        <MaterialIcon name={icon} className="text-xl" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </ContentCard>
  );
}

function RoomMetaRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
          <MaterialIcon name={icon} className="text-xl" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">{label}</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">{value}</p>
        </div>
      </div>
    </div>
  );
}

function GuidelineRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <p className="text-sm font-bold text-on-surface">{title}</p>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}

function AvatarBadge({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "xs" | "sm" | "md";
}) {
  const dimension =
    size === "xs" ? "h-7 w-7 text-[10px]" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${dimension} rounded-full border border-[rgb(186_158_255_/_0.26)] object-cover`} />;
  }

  return (
    <div className={`${dimension} flex items-center justify-center rounded-full border border-[rgb(186_158_255_/_0.26)] bg-surface-container-high font-bold text-on-surface`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function buildHostIdentity(room: RoomView | null, currentUser: SessionUser | null) {
  if (room && currentUser && currentUser.id === room.hostId) {
    return {
      username: currentUser.name,
      avatarUrl: currentUser.avatarUrl ?? null,
    };
  }

  if (!room) {
    return {
      username: "Host loading",
      avatarUrl: null,
    };
  }

  return {
    username: `Host ${room.hostId.slice(0, 6).toUpperCase()}`,
    avatarUrl: null,
  };
}

function getPlayerMode(room: RoomView | null) {
  if (!room) {
    return { kind: "loading" as const };
  }

  if (room.status === "ENDED" || room.status === "ARCHIVED") {
    return { kind: "ended" as const };
  }

  if (room.playbackUrl) {
    return { kind: "playing" as const };
  }

  if (room.status === "LIVE" || room.status === "PUBLISHED" || room.status === "DRAFT") {
    return { kind: "starting-soon" as const };
  }

  return { kind: "error" as const };
}

function mergeFeedEvents(current: FeedEvent[], incoming: FeedEvent) {
  const existingIndex = [...current].reverse().findIndex(
    (event) => event.sender === incoming.sender && event.giftName === incoming.giftName && incoming.createdAt - event.createdAt < 4_000,
  );

  if (existingIndex === -1) {
    return [...current, incoming];
  }

  const actualIndex = current.length - 1 - existingIndex;

  return current.map((event, index) =>
    index === actualIndex
      ? {
          ...event,
          quantity: event.quantity + incoming.quantity,
          createdAt: incoming.createdAt,
        }
      : event,
  );
}

function formatViewerCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return String(value);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeDate(value?: string | null) {
  if (!value) {
    return "Not started yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncateTitle(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan saat memuat room playback.";
}
