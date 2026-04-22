import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CategoryChip,
  ContentCard,
  PageContainer,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from "../../components/layout.js";
import { MediaPlayer } from "../../components/media-player.js";
import { apiRequest, ApiError } from "../../lib/api.js";

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

export function HomePage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLiveRooms() {
      setIsLoading(true);
      setError("");

      try {
        const response = await apiRequest<{ rooms: RoomView[] }>("/rooms/live?limit=12", {
          signal: controller.signal,
        });
        setRooms(response.rooms);
        setSelectedRoomId((current) => current ?? response.rooms[0]?.id ?? null);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadLiveRooms();

    return () => {
      controller.abort();
    };
  }, []);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0] ?? null;
  const totalViewers = rooms.reduce((sum, room) => sum + room.viewerCount, 0);
  const liveCount = rooms.filter((room) => room.status === "LIVE").length;
  const publishedCount = rooms.filter((room) => room.status === "PUBLISHED").length;
  const categorySummary = useMemo(() => buildCategorySummary(rooms), [rooms]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Discover"
        title="The Pulse of Live Entertainment"
        description="Home sekarang memakai data live room asli dari backend. Hero, live cards, dan playback stream tampil dari endpoint live rooms yang aktif."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>Refresh Live</SecondaryButton>
            <PrimaryButton type="button" onClick={() => {
              const target = document.getElementById("live-grid");
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>
              Browse Live
            </PrimaryButton>
          </div>
        }
      />

      <section className="hero-panel relative overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.28)] p-6 md:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-error px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-on-error">
                Live Now
              </span>
              <span className="inline-flex rounded-full border border-[rgb(105_246_184_/_0.18)] bg-[rgb(105_246_184_/_0.12)] px-3 py-1 text-xs font-semibold text-tertiary">
                {formatViewerCount(totalViewers)} total viewers
              </span>
              <span className="inline-flex rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface-variant">
                {liveCount} live, {publishedCount} warming up
              </span>
            </div>

            <h2 className="font-display text-4xl font-extrabold tracking-tight text-on-surface md:text-6xl">
              {selectedRoom ? selectedRoom.title : "Live rooms are loading"}
              <span className="mt-2 block brand-logo-gradient">
                {selectedRoom ? (selectedRoom.category || `Host ${shortHostId(selectedRoom.hostId)}`) : "Connecting to backend live feed"}
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-on-surface-variant md:text-lg">
              {selectedRoom
                ? selectedRoom.description || "Room ini sudah terhubung ke backend live rooms dan menampilkan playback stream asli dari server."
                : isLoading
                  ? "Mengambil data live room terbaru dari backend."
                  : "Belum ada live room yang aktif sekarang. Setelah host publish room dan mulai stream dari OBS, siaran akan tampil di sini."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton type="button" onClick={() => {
                if (!selectedRoom) {
                  return;
                }

                navigate(`/rooms/${selectedRoom.id}`);
              }} disabled={!selectedRoom?.playbackUrl}>
                Watch Featured
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => window.location.reload()}>
                Refresh Feed
              </SecondaryButton>
            </div>
          </div>

          <div id="featured-live-player">
            <MediaPlayer
              src={selectedRoom?.playbackUrl ?? null}
              poster={selectedRoom?.coverImageUrl ?? null}
              title={selectedRoom?.title ?? "No live room selected"}
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <section className="space-y-5">
        <SectionHeader
          title="Explore Categories"
          description="Kategori dirangkum dari room live backend yang sedang tersedia."
        />
        <div className="flex flex-wrap gap-3">
          <CategoryChip active>All</CategoryChip>
          {categorySummary.slice(0, 5).map((category) => (
            <CategoryChip key={category.label}>{category.label}</CategoryChip>
          ))}
        </div>
      </section>

      <section id="live-grid" className="space-y-6">
        <SectionHeader
          title="Live Rooms From Backend"
          description="Kartu di bawah ini diisi dari endpoint `/rooms/live` dan bisa dipilih untuk mengganti stream featured di atas."
        />
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.28)] bg-surface-container">
                <div className="aspect-video bg-surface-container-high" />
                <div className="space-y-3 p-4">
                  <div className="h-4 rounded bg-surface-container-high" />
                  <div className="h-3 w-2/3 rounded bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {rooms.map((room) => (
              <article
                key={room.id}
                className={`overflow-hidden rounded-xl border bg-surface-container text-left transition hover:-translate-y-1 ${
                  selectedRoom?.id === room.id
                    ? "border-[rgb(186_158_255_/_0.45)] shadow-[0_20px_60px_rgba(132,85,239,0.18)]"
                    : "border-[rgb(64_72_93_/_0.28)] hover:border-[rgb(186_158_255_/_0.32)]"
                }`}
              >
                <button type="button" onClick={() => setSelectedRoomId(room.id)} className="block w-full text-left">
                  <div className="relative aspect-video overflow-hidden">
                    {room.coverImageUrl ? (
                      <img src={room.coverImageUrl} alt={room.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(15,25,48,0.96),rgba(31,43,73,0.82))]">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                          {room.category || "Live Room"}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,14,32,0)_0%,rgba(6,14,32,0.74)_100%)]" />
                    <div className="absolute left-3 top-3 rounded-full bg-error px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-on-error">
                      {room.status}
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-full bg-[rgba(15,25,48,0.85)] px-3 py-1 text-[10px] font-semibold text-tertiary">
                      {formatViewerCount(room.viewerCount)} viewers
                    </div>
                  </div>
                </button>
                <div className="p-4">
                  <h3 className="truncate text-sm font-bold text-on-surface">{room.title}</h3>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">{room.description || `Room ${room.id}`}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-2 py-1 text-[10px] font-medium text-on-surface-variant">
                      {room.category || "Uncategorized"}
                    </span>
                    <span className="rounded-full border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-2 py-1 text-[10px] font-medium text-on-surface-variant">
                      Host {shortHostId(room.hostId)}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <SecondaryButton
                      type="button"
                      className="flex-1 px-3 py-2 text-xs"
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      Preview
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className="flex-1 px-3 py-2 text-xs"
                      onClick={() => navigate(`/rooms/${room.id}`)}
                    >
                      Open Room
                    </SecondaryButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyStateCard
            title="Belum ada livestream aktif"
            description="Setelah host publish room dan mulai stream dari OBS, playback stream asli akan muncul di Home secara otomatis."
          />
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
        <ContentCard>
          <SectionHeader
            title="Trending Right Now"
            description="Ringkasan ini disusun dari room live backend yang sedang tersedia."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MiniStat title="Live Rooms" value={String(rooms.length)} meta="Jumlah room yang sedang dipublikasikan atau sudah live." />
            <MiniStat title="Featured Status" value={selectedRoom?.status ?? "No room"} meta="Status room yang sedang tampil di hero player." />
            <MiniStat title="Total Viewers" value={formatViewerCount(totalViewers)} meta="Akumulasi viewer count dari endpoint live rooms." />
            <MiniStat title="Published Queue" value={String(publishedCount)} meta="Room yang sudah published dan siap menerima stream OBS." />
          </div>
        </ContentCard>

        <ContentCard>
          <SectionHeader title="Live Queue" description="Queue live room nyata dari backend agar mudah memilih featured stream lain." />
          <div className="mt-5 space-y-4">
            {rooms.length ? rooms.slice(0, 4).map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-3 text-left transition hover:bg-surface-container"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-sm font-bold text-on-surface">
                  {shortHostId(room.hostId)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{room.title}</p>
                  <p className="truncate text-xs text-on-surface-variant">{room.category || "Live room from backend"}</p>
                </div>
                <span className="text-xs font-semibold text-tertiary">{formatViewerCount(room.viewerCount)}</span>
              </button>
            )) : (
              <p className="text-sm text-on-surface-variant">Belum ada room aktif untuk dimasukkan ke queue.</p>
            )}
          </div>
        </ContentCard>
      </section>

      <section className="space-y-6 pb-6">
        <SectionHeader title="Browse Categories" description="Chip kategori sekarang menghitung room aktif nyata dari backend, bukan data dummy." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {categorySummary.map((category) => (
            <ContentCard key={category.label} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
                <span className="material-symbols-outlined text-3xl">{category.icon}</span>
              </div>
              <h3 className="text-sm font-bold text-on-surface">{category.label}</h3>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">
                {category.meta}
              </p>
            </ContentCard>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

function MiniStat({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-3 text-xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <ContentCard className="p-8 text-center">
      <h3 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
      <p className="mt-3 text-sm text-on-surface-variant">{description}</p>
    </ContentCard>
  );
}

function buildCategorySummary(rooms: RoomView[]) {
  const iconMap: Record<string, string> = {
    gaming: "sports_esports",
    "science & technology": "terminal",
    esports: "stadium",
    music: "graphic_eq",
    "just chatting": "forum",
    "creative arts": "palette",
  };

  const grouped = new Map<string, number>();

  for (const room of rooms) {
    const label = room.category?.trim() || "Uncategorized";
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([label, count]) => ({
      label,
      meta: `${count} live room${count > 1 ? "s" : ""}`,
      icon: iconMap[label.toLowerCase()] ?? "live_tv",
    }))
    .slice(0, 6);
}

function formatViewerCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
}

function shortHostId(hostId: string) {
  return hostId.slice(0, 4).toUpperCase();
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Gagal mengambil live rooms dari backend.";
}
