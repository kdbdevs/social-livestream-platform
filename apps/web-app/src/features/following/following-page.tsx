import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export function FollowingPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSession();
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadFollowing() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ users: FollowedUser[] }>("/users/me/following", {
          token: accessToken,
          signal: controller.signal,
        });

        setFollowedUsers(response.users);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadFollowing();

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const liveNowCount = useMemo(
    () => followedUsers.filter((followedUser) => followedUser.liveRoom?.status === "LIVE").length,
    [followedUsers],
  );
  const warmingUpCount = useMemo(
    () => followedUsers.filter((followedUser) => followedUser.liveRoom?.status === "PUBLISHED").length,
    [followedUsers],
  );
  const creatorCount = useMemo(
    () => followedUsers.filter((followedUser) => followedUser.role === "HOST").length,
    [followedUsers],
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Following"
        title="Users You Follow"
        description="Menu ini menampilkan daftar akun yang kamu follow. Jadi fokusnya user yang kamu ikuti, bukan channel."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Refresh List
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => navigate("/")}>
              Explore Live
            </PrimaryButton>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon="favorite"
          title="Total Following"
          value={isLoading ? "..." : String(followedUsers.length)}
          meta="Jumlah akun lain yang sedang kamu follow."
        />
        <StatCard
          icon="live_tv"
          title="Live Right Now"
          value={isLoading ? "..." : String(liveNowCount)}
          meta="Akun yang sekarang punya room berstatus LIVE."
        />
        <StatCard
          icon="podcasts"
          title="Creator Accounts"
          value={isLoading ? "..." : String(creatorCount)}
          meta={`${warmingUpCount} akun lain sedang published dan menunggu live.`}
        />
      </section>

      {error ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <ContentCard className="overflow-hidden p-0">
        <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(21,33,64,0.96),rgba(10,19,38,0.88))] px-5 py-5">
          <SectionHeader
            title="Followed Accounts"
            description={
              user
                ? `Daftar akun yang diikuti oleh ${user.handle}. Jika ada room aktif, status live-nya ikut ditampilkan di sini.`
                : "Daftar akun yang kamu follow dan status room aktifnya."
            }
          />
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-surface-container" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-surface-container" />
                      <div className="h-3 w-24 rounded bg-surface-container" />
                    </div>
                  </div>
                  <div className="mt-4 h-20 rounded-2xl bg-surface-container" />
                </div>
              ))}
            </div>
          ) : followedUsers.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {followedUsers.map((followedUser) => (
                <FollowedUserCard
                  key={followedUser.id}
                  user={followedUser}
                  onMessage={() => navigate(`/messages?user=${followedUser.id}`)}
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
              title="Belum ada user yang kamu follow"
              description="Saat kamu mulai follow akun lain, daftar mereka akan muncul di sini. Struktur ini sengaja memakai entitas user agar sesuai dengan backend yang belum punya channel entity."
              actionLabel="Kembali ke Home"
              onAction={() => navigate("/")}
            />
          )}
        </div>
      </ContentCard>
    </PageContainer>
  );
}

function FollowedUserCard({
  user,
  onMessage,
  onOpenRoom,
}: {
  user: FollowedUser;
  onMessage: () => void;
  onOpenRoom: () => void;
}) {
  const displayName = user.username?.trim() || `user-${user.id.slice(0, 6)}`;
  const handle = `@${displayName.replace(/[^a-zA-Z0-9_]+/g, "").toLowerCase()}`;
  const statusTone =
    user.liveRoom?.status === "LIVE"
      ? "border-[rgb(255_110_132_/_0.26)] bg-[rgb(167_1_56_/_0.18)] text-on-error-container"
      : user.liveRoom?.status === "PUBLISHED"
        ? "border-[rgb(105_246_184_/_0.26)] bg-[rgb(105_246_184_/_0.12)] text-tertiary"
        : "border-[rgb(64_72_93_/_0.24)] bg-surface-container text-on-surface-variant";
  const statusLabel =
    user.liveRoom?.status === "LIVE"
      ? "Live now"
      : user.liveRoom?.status === "PUBLISHED"
        ? "Ready to go live"
        : "Offline";

  return (
    <article className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5 shadow-[0_16px_44px_rgba(2,8,24,0.2)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <AvatarBadge name={displayName} avatarUrl={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-bold text-on-surface">{displayName}</h3>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${statusTone}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">{handle}</p>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {user.bio?.trim() || `Role ${user.role.toLowerCase()} ini sudah kamu follow sejak ${formatFollowDate(user.followedAt)}.`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="rounded-2xl border border-[rgb(64_72_93_/_0.2)] bg-surface-container p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Current Activity</p>
          {user.liveRoom ? (
            <>
              <p className="mt-3 text-sm font-bold text-on-surface">{user.liveRoom.title}</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {user.liveRoom.category || "Uncategorized"} · {user.liveRoom.status}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                {user.liveRoom.startedAt ? `Started ${formatStartedAt(user.liveRoom.startedAt)}` : "Room sudah dipublish dan siap dipantau."}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold text-on-surface">No active room</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Akun ini belum punya room aktif yang berstatus published atau live.
              </p>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={onMessage}>
            Message
          </SecondaryButton>
          <SecondaryButton type="button" className="px-4 py-2 text-xs">
            {user.role}
          </SecondaryButton>
          <PrimaryButton type="button" className="px-4 py-2 text-xs" onClick={onOpenRoom} disabled={!user.liveRoom}>
            Open Room
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
}

function StatCard({
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

function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <ContentCard className="p-8 text-center">
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

function formatFollowDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatStartedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
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

  return "Gagal mengambil daftar following.";
}
