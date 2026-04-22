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

type WatchHistoryItem = {
  watchedAt: string;
  room: RoomView;
};

export function WatchHistoryPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSession();
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ items: WatchHistoryItem[] }>("/rooms/history?limit=20", {
          token: accessToken,
          signal: controller.signal,
        });

        setItems(response.items);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadHistory();

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const liveHistoryCount = useMemo(
    () => items.filter((item) => item.room.status === "LIVE" || item.room.status === "PUBLISHED").length,
    [items],
  );
  const categoryCount = useMemo(
    () => new Set(items.map((item) => item.room.category?.trim() || "Uncategorized")).size,
    [items],
  );
  const mostRecentItem = items[0] ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Personal"
        title="Watch History"
        description="Riwayat ini sekarang benar-benar dibaca dari backend. Saat user membuka room, aplikasi mencatat view sekali ke audit log lalu menampilkannya di halaman ini."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Refresh History
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => navigate("/")}>
              Explore Live
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
        <HistoryStatCard
          icon="history"
          title="Tracked Rooms"
          value={isLoading ? "..." : String(items.length)}
          meta="Jumlah room unik yang sudah tercatat di history backend."
        />
        <HistoryStatCard
          icon="live_tv"
          title="Still Active"
          value={isLoading ? "..." : String(liveHistoryCount)}
          meta="Room di history yang masih live atau published."
        />
        <HistoryStatCard
          icon="category"
          title="Categories Seen"
          value={isLoading ? "..." : String(categoryCount)}
          meta="Keragaman kategori dari room yang pernah kamu buka."
        />
        <HistoryStatCard
          icon="person"
          title="Viewer"
          value={user?.handle ?? "@neonpulse"}
          meta="Session aktif yang memiliki riwayat tontonan ini."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ContentCard className="overflow-hidden p-0">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(20,34,62,0.96),rgba(8,17,34,0.9))] px-6 py-5">
            <SectionHeader
              title="Most Recent Watch"
              description="Highlight ini diambil dari room terakhir yang tersimpan dalam history unik terbaru."
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 p-6">
              <div className="h-24 rounded-xl bg-surface-container-high" />
              <div className="h-40 rounded-xl bg-surface-container-high" />
            </div>
          ) : mostRecentItem ? (
            <div className="grid gap-5 p-6">
              <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Last Opened Room</p>
                    <h2 className="mt-3 truncate font-display text-3xl font-black tracking-tight text-on-surface">
                      {mostRecentItem.room.title}
                    </h2>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      {mostRecentItem.room.category || "Uncategorized"} · Watched {formatDateTime(mostRecentItem.watchedAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusClassName(mostRecentItem.room.status)}`}>
                    {mostRecentItem.room.status}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  {mostRecentItem.room.description || "Room ini tidak punya deskripsi, tapi histori view-nya tetap tercatat di backend."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <PrimaryButton type="button" onClick={() => navigate(`/rooms/${mostRecentItem.room.id}`)}>
                    Open Again
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => navigate("/")}>
                    Browse More
                  </SecondaryButton>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <InsightTile
                  icon="schedule"
                  label="Watched At"
                  value={formatShortDate(mostRecentItem.watchedAt)}
                  meta="Waktu terakhir room ini direkam ke history."
                />
                <InsightTile
                  icon="movie"
                  label="Room Status"
                  value={mostRecentItem.room.status}
                  meta="Status room terbaru yang terbaca saat history dimuat."
                />
                <InsightTile
                  icon="forum"
                  label="Chat Mode"
                  value={mostRecentItem.room.chatEnabled ? "Enabled" : "Disabled"}
                  meta="Snapshot properti room saat dibaca dari backend."
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EmptyStateCard
                title="Belum ada watch history"
                description="Buka room mana pun saat login, lalu aplikasi akan mencatat kunjungan itu ke backend dan menampilkannya di sini."
                actionLabel="Open Home"
                onAction={() => navigate("/")}
                compact
              />
            </div>
          )}
        </ContentCard>

        <div className="space-y-6">
          <ContentCard>
            <SectionHeader
              title="How It Is Recorded"
              description="Penjelasan singkat supaya user dan tim tahu history ini bukan dummy UI."
            />
            <div className="mt-5 space-y-3">
              <CoverageRow
                icon="check_circle"
                title="Room open tracking"
                description="Saat room page dibuka oleh user yang login, frontend memanggil endpoint backend untuk mencatat `room.viewed`."
              />
              <CoverageRow
                icon="check_circle"
                title="Stored in backend"
                description="Riwayat disimpan lewat audit log backend, bukan local state semata."
              />
              <CoverageRow
                icon="check_circle"
                title="Unique recent history"
                description="Daftar ini menampilkan room unik terbaru, jadi tidak spam dengan entri berulang dari room yang sama."
              />
            </div>
          </ContentCard>

          <ContentCard>
            <SectionHeader
              title="Quick Resume"
              description="Room yang masih aktif dari history kamu bisa dibuka ulang langsung."
            />
            <div className="mt-5 space-y-3">
              {items.filter((item) => item.room.status === "LIVE" || item.room.status === "PUBLISHED").slice(0, 4).length ? (
                items
                  .filter((item) => item.room.status === "LIVE" || item.room.status === "PUBLISHED")
                  .slice(0, 4)
                  .map((item) => (
                    <button
                      key={item.room.id}
                      type="button"
                      onClick={() => navigate(`/rooms/${item.room.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4 text-left transition hover:bg-surface-container"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
                        <MaterialIcon name="play_circle" className="text-xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-on-surface">{item.room.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.room.category || "Uncategorized"} · watched {formatShortDate(item.watchedAt)}
                        </p>
                      </div>
                    </button>
                  ))
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada room aktif di dalam history kamu.</p>
              )}
            </div>
          </ContentCard>
        </div>
      </section>

      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
          <SectionHeader
            title="Recent Watch Entries"
            description="Daftar room unik terbaru yang pernah kamu buka saat login."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[rgb(64_72_93_/_0.14)] text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                <th className="px-6 py-4 font-bold">Room</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Watched At</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-on-surface-variant">
                    Loading watch history...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.room.id} className="border-b border-[rgb(64_72_93_/_0.1)] last:border-b-0 hover:bg-surface-container-high/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.12)] text-primary">
                          <MaterialIcon name="history" className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">{item.room.title}</p>
                          <p className="truncate text-xs text-on-surface-variant">{item.room.description || item.room.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.room.category || "-"}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDateTime(item.watchedAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStatusClassName(item.room.status)}`}>
                        {item.room.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={() => navigate(`/rooms/${item.room.id}`)}>
                        Open Room
                      </SecondaryButton>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-on-surface-variant">
                    Belum ada riwayat tontonan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ContentCard>
    </PageContainer>
  );
}

function HistoryStatCard({
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

function InsightTile({
  icon,
  label,
  value,
  meta,
}: {
  icon: string;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-lg" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function CoverageRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[rgb(64_72_93_/_0.2)] bg-surface-container-high p-4">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(105_246_184_/_0.12)] text-tertiary">
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

function getStatusClassName(status: RoomView["status"]) {
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Gagal mengambil watch history.";
}
