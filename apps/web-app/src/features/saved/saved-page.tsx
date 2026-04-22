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

type SavedRoomItem = {
  savedAt: string;
  room: RoomView;
};

export function SavedPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSession();
  const [items, setItems] = useState<SavedRoomItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSaved() {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ items: SavedRoomItem[] }>("/rooms/saved?limit=20", {
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

    void loadSaved();

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const activeSavedCount = useMemo(
    () => items.filter((item) => item.room.status === "LIVE" || item.room.status === "PUBLISHED").length,
    [items],
  );
  const totalViewers = useMemo(
    () => items.reduce((sum, item) => sum + item.room.viewerCount, 0),
    [items],
  );
  const featuredItem = items[0] ?? null;

  async function handleRemove(roomId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await apiRequest<{ roomId: string; saved: boolean }>(`/rooms/${roomId}/save`, {
        method: "DELETE",
        token: accessToken,
      });
      setItems((current) => current.filter((item) => item.room.id !== roomId));
    } catch (removeError) {
      setError(resolveErrorMessage(removeError));
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Personal"
        title="Saved"
        description="Daftar ini sekarang benar-benar memakai backend. Room yang kamu simpan dicatat sebagai state saved di audit log dan ditampilkan kembali di halaman ini."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Refresh Saved
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
        <SavedStatCard
          icon="bookmark"
          title="Saved Rooms"
          value={isLoading ? "..." : String(items.length)}
          meta="Jumlah room unik yang saat ini masih berstatus saved."
        />
        <SavedStatCard
          icon="live_tv"
          title="Active Saved"
          value={isLoading ? "..." : String(activeSavedCount)}
          meta="Room saved yang masih LIVE atau PUBLISHED."
        />
        <SavedStatCard
          icon="groups"
          title="Viewer Snapshot"
          value={isLoading ? "..." : formatViewerCount(totalViewers)}
          meta="Akumulasi viewer snapshot dari room yang disimpan."
        />
        <SavedStatCard
          icon="person"
          title="Library Owner"
          value={user?.handle ?? "@neonpulse"}
          meta="Session aktif yang memiliki koleksi saved ini."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ContentCard className="overflow-hidden p-0">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(21,34,62,0.96),rgba(9,17,35,0.9))] px-6 py-5">
            <SectionHeader
              title="Saved Highlight"
              description="Room saved terbaru kamu ditampilkan sebagai highlight utama agar mudah dibuka kembali."
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 p-6">
              <div className="h-24 rounded-xl bg-surface-container-high" />
              <div className="h-40 rounded-xl bg-surface-container-high" />
            </div>
          ) : featuredItem ? (
            <div className="grid gap-5 p-6">
              <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Most Recently Saved</p>
                    <h2 className="mt-3 truncate font-display text-3xl font-black tracking-tight text-on-surface">
                      {featuredItem.room.title}
                    </h2>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      {featuredItem.room.category || "Uncategorized"} · Saved {formatDateTime(featuredItem.savedAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusClassName(featuredItem.room.status)}`}>
                    {featuredItem.room.status}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  {featuredItem.room.description || "Room ini tidak punya deskripsi, tapi tetap bisa kamu simpan dan buka kembali dari library pribadi ini."}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <SavedMetric label="Viewers" value={formatViewerCount(featuredItem.room.viewerCount)} icon="groups" />
                  <SavedMetric label="Chat" value={featuredItem.room.chatEnabled ? "Enabled" : "Disabled"} icon="forum" />
                  <SavedMetric label="Gift" value={featuredItem.room.giftEnabled ? "Enabled" : "Disabled"} icon="redeem" />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <PrimaryButton type="button" onClick={() => navigate(`/rooms/${featuredItem.room.id}`)}>
                    Open Room
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => void handleRemove(featuredItem.room.id)}>
                    Remove From Saved
                  </SecondaryButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EmptyStateCard
                title="Belum ada room yang disimpan"
                description="Buka room mana pun saat login lalu tekan tombol save. Room itu akan langsung masuk ke library ini."
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
              title="How Save Works"
              description="Panel ini menjelaskan dengan jujur bagaimana backend menyimpan state saved."
            />
            <div className="mt-5 space-y-3">
              <CoverageRow
                icon="check_circle"
                title="Saved state in backend"
                description="State saved disimpan sebagai aksi `room.saved` dan `room.unsaved` di audit log backend."
              />
              <CoverageRow
                icon="check_circle"
                title="Unique saved library"
                description="Halaman ini menampilkan state terbaru per room, jadi tidak ada duplikasi room yang sama."
              />
              <CoverageRow
                icon="check_circle"
                title="Connected to room page"
                description="Tombol save di halaman room langsung menambah atau menghapus item dari library pribadi user."
              />
            </div>
          </ContentCard>

          <ContentCard>
            <SectionHeader
              title="Quick Resume"
              description="Room saved yang masih aktif bisa langsung dilanjutkan dari sini."
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
                          {item.room.category || "Uncategorized"} · saved {formatShortDate(item.savedAt)}
                        </p>
                      </div>
                    </button>
                  ))
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada room aktif di dalam saved list kamu.</p>
              )}
            </div>
          </ContentCard>
        </div>
      </section>

      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
          <SectionHeader
            title="Saved Library"
            description="Daftar room yang saat ini masih kamu simpan."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[rgb(64_72_93_/_0.14)] text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                <th className="px-6 py-4 font-bold">Room</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Saved At</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-on-surface-variant">
                    Loading saved rooms...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.room.id} className="border-b border-[rgb(64_72_93_/_0.1)] last:border-b-0 hover:bg-surface-container-high/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.12)] text-primary">
                          <MaterialIcon name="bookmark" className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">{item.room.title}</p>
                          <p className="truncate text-xs text-on-surface-variant">{item.room.description || item.room.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.room.category || "-"}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDateTime(item.savedAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStatusClassName(item.room.status)}`}>
                        {item.room.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={() => navigate(`/rooms/${item.room.id}`)}>
                          Open
                        </SecondaryButton>
                        <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={() => void handleRemove(item.room.id)}>
                          Remove
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-on-surface-variant">
                    Belum ada room yang disimpan.
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

function SavedStatCard({
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

function SavedMetric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,158,255,0.12)] text-primary">
        <MaterialIcon name={icon} className="text-lg" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <p className="mt-2 text-xl font-bold text-on-surface">{value}</p>
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

function formatViewerCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
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

  return "Gagal mengambil saved rooms.";
}
