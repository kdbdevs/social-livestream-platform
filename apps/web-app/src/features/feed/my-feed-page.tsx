import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CategoryChip,
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

type FollowedUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  role: "VIEWER" | "HOST" | "ADMIN";
  bio: string | null;
  followedAt: string;
  liveRoom: {
    id: string;
    title: string;
    category: string | null;
    status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED";
    coverImageUrl: string | null;
    startedAt: string | null;
  } | null;
};

type RoomView = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  category: string | null;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED";
  chatEnabled: boolean;
  giftEnabled: boolean;
  playbackUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RoomStatus = RoomView["status"];

export function MyFeedPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSession();
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [liveRooms, setLiveRooms] = useState<RoomView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeed() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const [followingResult, liveResult] = await Promise.allSettled([
          apiRequest<{ users: FollowedUser[] }>("/users/me/following", {
            token: accessToken,
            signal: controller.signal,
          }),
          apiRequest<{ rooms: RoomView[] }>("/rooms/live?limit=12", {
            signal: controller.signal,
          }),
        ]);

        if (followingResult.status === "fulfilled") {
          setFollowedUsers(followingResult.value.users);
        } else if (!isAbortError(followingResult.reason)) {
          throw followingResult.reason;
        }

        if (liveResult.status === "fulfilled") {
          setLiveRooms(liveResult.value.rooms);
        } else if (!isAbortError(liveResult.reason)) {
          throw liveResult.reason;
        }
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadFeed();

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const followedLiveUsers = useMemo(
    () => followedUsers.filter((followedUser) => followedUser.liveRoom?.status === "LIVE" || followedUser.liveRoom?.status === "PUBLISHED"),
    [followedUsers],
  );
  const followedOfflineUsers = useMemo(
    () => followedUsers.filter((followedUser) => !followedUser.liveRoom),
    [followedUsers],
  );
  const followedIds = useMemo(() => new Set(followedUsers.map((followedUser) => followedUser.id)), [followedUsers]);
  const discoveryRooms = useMemo(
    () => liveRooms.filter((room) => !followedIds.has(room.hostId)),
    [followedIds, liveRooms],
  );
  const highlightedFollow = followedLiveUsers[0] ?? null;
  const highlightedDiscovery = discoveryRooms[0] ?? liveRooms[0] ?? null;
  const topCategories = useMemo(() => buildCategorySummary(liveRooms), [liveRooms]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Personal"
        title="My Feed"
        description="Halaman ini dirakit dari backend yang memang tersedia sekarang: akun yang kamu follow dari `/users/me/following` dan room live publik dari `/rooms/live`."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Refresh Feed
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => navigate("/")}>
              Explore Home
            </PrimaryButton>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <FeedStatCard
          icon="favorite"
          title="Following"
          value={isLoading ? "..." : String(followedUsers.length)}
          meta="Total akun yang kamu follow."
        />
        <FeedStatCard
          icon="live_tv"
          title="From Your Network"
          value={isLoading ? "..." : String(followedLiveUsers.length)}
          meta="Akun yang kamu follow dan sedang live atau published."
        />
        <FeedStatCard
          icon="travel_explore"
          title="Discovery Live"
          value={isLoading ? "..." : String(discoveryRooms.length)}
          meta="Room live publik di luar akun yang kamu follow."
        />
        <FeedStatCard
          icon="person"
          title="Session"
          value={user?.handle ?? "@neonpulse"}
          meta="Identitas session aktif yang sedang melihat feed ini."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <ContentCard className="overflow-hidden p-0">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(19,33,61,0.96),rgba(8,17,35,0.92))] px-6 py-5">
            <SectionHeader
              title="Feed Highlight"
              description="Prioritas utama feed adalah room dari akun yang kamu follow. Kalau belum ada, kami jatuhkan ke live room publik yang sedang tersedia."
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 p-6">
              <div className="h-24 rounded-xl bg-surface-container-high" />
              <div className="h-40 rounded-xl bg-surface-container-high" />
            </div>
          ) : highlightedFollow || highlightedDiscovery ? (
            <div className="grid gap-6 p-6">
              {highlightedFollow ? (
                <HighlightedFollowCard
                  user={highlightedFollow}
                  onOpenRoom={() => {
                    if (highlightedFollow.liveRoom) {
                      navigate(`/rooms/${highlightedFollow.liveRoom.id}`);
                    }
                  }}
                />
              ) : null}

              {!highlightedFollow && highlightedDiscovery ? (
                <HighlightedDiscoveryCard
                  room={highlightedDiscovery}
                  onOpenRoom={() => navigate(`/rooms/${highlightedDiscovery.id}`)}
                />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <InsightTile
                  label="Followed Live"
                  value={String(followedLiveUsers.length)}
                  meta="Jumlah akun di network kamu yang sedang punya room aktif."
                  icon="groups"
                />
                <InsightTile
                  label="Offline Network"
                  value={String(followedOfflineUsers.length)}
                  meta="Akun yang kamu follow tapi belum punya room aktif."
                  icon="bedtime"
                />
                <InsightTile
                  label="Live Catalog"
                  value={String(liveRooms.length)}
                  meta="Jumlah room yang berhasil dimuat dari endpoint live rooms."
                  icon="sensors"
                />
              </div>
            </div>
          ) : (
            <EmptyStateCard
              title="Feed kamu masih kosong"
              description="Belum ada akun yang kamu follow dan belum ada live room publik yang bisa dijadikan highlight."
              actionLabel="Go to Home"
              onAction={() => navigate("/")}
            />
          )}
        </ContentCard>

        <div className="space-y-6">
          <ContentCard>
            <SectionHeader
              title="Category Pulse"
              description="Ringkasan kategori dari live room publik yang sekarang sedang tersedia."
            />
            <div className="mt-5 flex flex-wrap gap-3">
              {topCategories.length ? (
                topCategories.map((category, index) => (
                  <CategoryChip key={category.label} active={index === 0}>
                    {category.label} · {category.count}
                  </CategoryChip>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada kategori aktif untuk dirangkum.</p>
              )}
            </div>
          </ContentCard>

          <ContentCard>
            <SectionHeader
              title="Why This Feed Works"
              description="Panel ini sengaja transparan soal data yang dipakai agar halaman tetap selaras dengan backend."
            />
            <div className="mt-5 space-y-3">
              <CoverageRow
                icon="check_circle"
                title="Following network"
                description="Diambil dari relasi follow user-ke-user, bukan channel."
              />
              <CoverageRow
                icon="check_circle"
                title="Live discovery"
                description="Diambil dari daftar room live publik yang memang sudah tersedia di backend."
              />
              <CoverageRow
                icon="schedule"
                title="No fake recommendations"
                description="Halaman ini belum memakai engine rekomendasi karena backend belum menyediakan sinyal personalisasi yang lebih kaya."
                subtle
              />
            </div>
          </ContentCard>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ContentCard className="p-0 overflow-hidden">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
            <SectionHeader
              title="From People You Follow"
              description="Daftar ini memprioritaskan akun yang memang sudah ada di graph following milik kamu."
            />
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                    <div className="h-20 rounded-xl bg-surface-container" />
                  </div>
                ))}
              </div>
            ) : followedUsers.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {followedUsers.slice(0, 6).map((followedUser) => (
                  <FollowFeedCard
                    key={followedUser.id}
                    user={followedUser}
                    onOpenRoom={() => {
                      if (followedUser.liveRoom) {
                        navigate(`/rooms/${followedUser.liveRoom.id}`);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title="Belum ada akun di network kamu"
                description="Saat kamu follow user lain, bagian ini akan berubah menjadi feed personal dari network kamu sendiri."
                actionLabel="Open Following"
                onAction={() => navigate("/following")}
                compact
              />
            )}
          </div>
        </ContentCard>

        <ContentCard className="p-0 overflow-hidden">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
            <SectionHeader
              title="Discovery Queue"
              description="Live room publik yang belum berasal dari akun yang kamu follow."
            />
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-xl bg-surface-container-high" />
                ))}
              </div>
            ) : discoveryRooms.length ? (
              <div className="space-y-3">
                {discoveryRooms.slice(0, 6).map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4 text-left transition hover:bg-surface-container"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
                      <MaterialIcon name={room.status === "LIVE" ? "radio_button_checked" : "explore"} className="text-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-on-surface">{room.title}</p>
                      <p className="mt-1 truncate text-xs text-on-surface-variant">
                        {room.category || "Uncategorized"} · {formatViewerCount(room.viewerCount)} viewers
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getRoomStatusClassName(room.status)}`}>
                      {room.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title="Tidak ada discovery tambahan"
                description="Semua room live yang tersedia saat ini kemungkinan sudah berasal dari akun yang kamu follow, atau memang belum ada room aktif lain."
                actionLabel="Browse Home"
                onAction={() => navigate("/")}
                compact
              />
            )}
          </div>
        </ContentCard>
      </section>
    </PageContainer>
  );
}

function FeedStatCard({
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
    <ContentCard>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-xl" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-2 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </ContentCard>
  );
}

function HighlightedFollowCard({
  user,
  onOpenRoom,
}: {
  user: FollowedUser;
  onOpenRoom: () => void;
}) {
  const displayName = user.username?.trim() || `user-${user.id.slice(0, 6)}`;

  return (
    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">From Your Network</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <AvatarBadge name={displayName} avatarUrl={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-2xl font-black text-on-surface">{displayName}</h3>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getRoomStatusClassName(user.liveRoom?.status ?? "DRAFT")}`}>
              {user.liveRoom?.status ?? "OFFLINE"}
            </span>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {user.liveRoom
              ? `${user.liveRoom.title} · ${user.liveRoom.category || "Uncategorized"}`
              : "Belum ada room aktif dari akun ini."}
          </p>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {user.bio?.trim() || `Kamu sudah follow akun ini sejak ${formatFollowDate(user.followedAt)}.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton type="button" onClick={onOpenRoom} disabled={!user.liveRoom}>
              Open Followed Room
            </PrimaryButton>
            <SecondaryButton type="button">
              {user.role}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightedDiscoveryCard({
  room,
  onOpenRoom,
}: {
  room: RoomView;
  onOpenRoom: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Discovery Fallback</p>
      <h3 className="mt-4 text-2xl font-black text-on-surface">{room.title}</h3>
      <p className="mt-2 text-sm text-on-surface-variant">
        {room.category || "Uncategorized"} · {formatViewerCount(room.viewerCount)} viewers · {room.status}
      </p>
      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
        {room.description || "Room ini muncul sebagai fallback karena network yang kamu follow belum punya live room aktif sekarang."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <PrimaryButton type="button" onClick={onOpenRoom}>
          Open Live Room
        </PrimaryButton>
        <SecondaryButton type="button">
          Explore
        </SecondaryButton>
      </div>
    </div>
  );
}

function InsightTile({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: string;
  meta: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-lg" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function FollowFeedCard({
  user,
  onOpenRoom,
}: {
  user: FollowedUser;
  onOpenRoom: () => void;
}) {
  const displayName = user.username?.trim() || `user-${user.id.slice(0, 6)}`;

  return (
    <article className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
      <div className="flex items-start gap-4">
        <AvatarBadge name={displayName} avatarUrl={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-bold text-on-surface">{displayName}</h3>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getRoomStatusClassName(user.liveRoom?.status ?? "DRAFT")}`}>
              {user.liveRoom ? user.liveRoom.status : "OFFLINE"}
            </span>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {user.liveRoom
              ? `${user.liveRoom.title} · ${user.liveRoom.category || "Uncategorized"}`
              : `Followed since ${formatFollowDate(user.followedAt)}`}
          </p>
          <div className="mt-4 flex gap-2">
            <SecondaryButton type="button" className="px-4 py-2 text-xs">
              {user.role}
            </SecondaryButton>
            <PrimaryButton type="button" className="px-4 py-2 text-xs" onClick={onOpenRoom} disabled={!user.liveRoom}>
              Open Room
            </PrimaryButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function CoverageRow({
  icon,
  title,
  description,
  subtle = false,
}: {
  icon: string;
  title: string;
  description: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[rgb(64_72_93_/_0.2)] bg-surface-container-high p-4">
      <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${subtle ? "bg-surface-container text-on-surface-variant" : "bg-[rgb(105_246_184_/_0.12)] text-tertiary"}`}>
        <MaterialIcon name={icon} className="text-lg" />
      </div>
      <div>
        <p className="text-sm font-bold text-on-surface">{title}</p>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
}) {
  return (
    <ContentCard className={`${compact ? "p-6 text-left" : "p-8 text-center"}`}>
      <h3 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
      <p className="mt-3 text-sm text-on-surface-variant">{description}</p>
      <div className="mt-6">
        <PrimaryButton type="button" onClick={onAction}>
          {actionLabel}
        </PrimaryButton>
      </div>
    </ContentCard>
  );
}

function AvatarBadge({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-14 w-14 rounded-full border border-[rgb(186_158_255_/_0.28)] object-cover" />;
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgb(186_158_255_/_0.28)] bg-surface-container text-sm font-bold text-on-surface">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function buildCategorySummary(rooms: RoomView[]) {
  const grouped = new Map<string, number>();

  for (const room of rooms) {
    const label = room.category?.trim() || "Uncategorized";
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function getRoomStatusClassName(status: RoomStatus) {
  switch (status) {
    case "LIVE":
      return "bg-[rgb(255_110_132_/_0.12)] text-error";
    case "PUBLISHED":
      return "bg-[rgb(105_246_184_/_0.12)] text-tertiary";
    case "ENDED":
      return "bg-surface-container-high text-on-surface-variant";
    case "ARCHIVED":
      return "bg-[rgb(64_72_93_/_0.2)] text-on-surface-variant";
    default:
      return "bg-[rgb(186_158_255_/_0.08)] text-primary";
  }
}

function formatViewerCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
}

function formatFollowDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Gagal mengambil data My Feed.";
}
