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

const ALL_CATEGORY = "All";

export function BrowsePage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadBrowseRooms() {
      setIsLoading(true);
      setError("");

      try {
        const query = selectedCategory !== ALL_CATEGORY ? `?limit=24&category=${encodeURIComponent(selectedCategory)}` : "?limit=24";
        const response = await apiRequest<{ rooms: RoomView[] }>(`/rooms/live${query}`, {
          signal: controller.signal,
        });

        setRooms(response.rooms);
        setSelectedRoomId((current) => {
          if (current && response.rooms.some((room) => room.id === current)) {
            return current;
          }

          return response.rooms[0]?.id ?? null;
        });
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    void loadBrowseRooms();

    return () => {
      controller.abort();
    };
  }, [selectedCategory]);

  const categories = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const room of rooms) {
      const label = room.category?.trim() || "Uncategorized";
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    }

    return [ALL_CATEGORY, ...Array.from(grouped.keys())];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return rooms;
    }

    return rooms.filter((room) => {
      const haystack = [room.title, room.description || "", room.category || ""].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [rooms, searchValue]);

  const selectedRoom = filteredRooms.find((room) => room.id === selectedRoomId) ?? filteredRooms[0] ?? null;
  const totalViewers = filteredRooms.reduce((sum, room) => sum + room.viewerCount, 0);
  const liveCount = filteredRooms.filter((room) => room.status === "LIVE").length;
  const publishedCount = filteredRooms.filter((room) => room.status === "PUBLISHED").length;
  const highlightedCategories = useMemo(() => buildCategoryHighlights(filteredRooms), [filteredRooms]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Browse"
        title="Discover Live Rooms"
        description="Browse sekarang memakai data live room publik dari backend. Fokusnya katalog siaran aktif, filter kategori, dan preview room tanpa invent fitur yang belum tersedia."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => window.location.reload()}>
              Refresh Browse
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => selectedRoom && navigate(`/rooms/${selectedRoom.id}`)} disabled={!selectedRoom}>
              Open Selected Room
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
        <BrowseStatCard
          icon="grid_view"
          title="Visible Rooms"
          value={isLoading ? "..." : String(filteredRooms.length)}
          meta="Jumlah room yang lolos filter browse saat ini."
        />
        <BrowseStatCard
          icon="sensors"
          title="Live Now"
          value={isLoading ? "..." : String(liveCount)}
          meta="Room dengan status LIVE dari katalog yang sedang tampil."
        />
        <BrowseStatCard
          icon="schedule"
          title="Warming Up"
          value={isLoading ? "..." : String(publishedCount)}
          meta="Room yang sudah published dan siap menerima stream."
        />
        <BrowseStatCard
          icon="groups"
          title="Viewer Snapshot"
          value={isLoading ? "..." : formatViewerCount(totalViewers)}
          meta="Akumulasi viewerCount dari room yang sedang tampil."
        />
      </section>

      <ContentCard className="space-y-5">
        <SectionHeader
          title="Explore Filters"
          description="Filter kategori memakai parameter `category` dari endpoint live rooms. Search di bawah menyaring hasil yang sudah dimuat."
        />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-on-surface">Search rooms</span>
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Cari judul room, deskripsi, atau kategori"
              className="h-12 w-full rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-surface-container-high pl-12 pr-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.42)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.18)]"
            />
          </div>
        </label>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <button key={category} type="button" onClick={() => setSelectedCategory(category)}>
              <CategoryChip active={selectedCategory === category}>{category}</CategoryChip>
            </button>
          ))}
        </div>
      </ContentCard>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ContentCard className="overflow-hidden">
          <SectionHeader
            title="Selected Room Preview"
            description="Panel preview ini memudahkan user menjelajah katalog tanpa harus langsung pindah ke room watch page."
          />

          {isLoading ? (
            <div className="mt-5 grid gap-4">
              <div className="aspect-video rounded-xl bg-surface-container-high" />
              <div className="h-24 rounded-xl bg-surface-container-high" />
            </div>
          ) : selectedRoom ? (
            <div className="mt-5 grid gap-5">
              <MediaPlayer
                src={selectedRoom.playbackUrl}
                poster={selectedRoom.coverImageUrl}
                title={selectedRoom.title}
              />

              <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-3xl font-black tracking-tight text-on-surface">
                      {selectedRoom.title}
                    </h2>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      {selectedRoom.category || "Uncategorized"} · Host {shortHostId(selectedRoom.hostId)} · Updated {formatDateTime(selectedRoom.updatedAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusClassName(selectedRoom.status)}`}>
                    {selectedRoom.status}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  {selectedRoom.description || "Room ini belum punya deskripsi, tapi playback dan metadata publiknya sudah tersedia untuk dibrowse."}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <PreviewMetric label="Viewer Count" value={formatViewerCount(selectedRoom.viewerCount)} icon="groups" />
                  <PreviewMetric label="Chat" value={selectedRoom.chatEnabled ? "Enabled" : "Disabled"} icon="forum" />
                  <PreviewMetric label="Gift" value={selectedRoom.giftEnabled ? "Enabled" : "Disabled"} icon="redeem" />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <PrimaryButton type="button" onClick={() => navigate(`/rooms/${selectedRoom.id}`)}>
                    Open Room
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setSearchValue(selectedRoom.category || "")}>
                    More Like This
                  </SecondaryButton>
                </div>
              </div>
            </div>
          ) : (
            <EmptyStateCard
              title="Belum ada room untuk dibrowse"
              description="Kategori atau search yang dipilih belum mengembalikan room publik yang aktif."
            />
          )}
        </ContentCard>

        <div className="space-y-6">
          <ContentCard>
            <SectionHeader
              title="Category Highlights"
              description="Ringkasan cepat kategori yang paling dominan dari hasil browse saat ini."
            />
            <div className="mt-5 space-y-3">
              {highlightedCategories.length ? (
                highlightedCategories.map((category) => (
                  <CategorySummaryRow
                    key={category.label}
                    label={category.label}
                    count={category.count}
                    viewers={category.viewers}
                  />
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Belum ada kategori yang bisa dirangkum.</p>
              )}
            </div>
          </ContentCard>

          <ContentCard>
            <SectionHeader
              title="Browse Coverage"
              description="Penjelasan singkat supaya scope halaman ini tetap konsisten dengan backend."
            />
            <div className="mt-5 space-y-3">
              <CoverageRow
                icon="check_circle"
                title="Public live catalog"
                description="Seluruh kartu berasal dari endpoint `/rooms/live`."
              />
              <CoverageRow
                icon="check_circle"
                title="Exact category filter"
                description="Filter kategori memakai parameter backend, bukan kategori buatan frontend."
              />
              <CoverageRow
                icon="schedule"
                title="No host profile search yet"
                description="Browse belum memakai index host atau full-text search karena backend saat ini belum menyediakannya."
                subtle
              />
            </div>
          </ContentCard>
        </div>
      </section>

      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
          <SectionHeader
            title="Browse Catalog"
            description="Semua room aktif yang berhasil dimuat untuk filter saat ini."
          />
        </div>

        {isLoading ? (
          <div className="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.28)] bg-surface-container">
                <div className="aspect-video bg-surface-container-high" />
                <div className="space-y-3 p-4">
                  <div className="h-4 rounded bg-surface-container-high" />
                  <div className="h-3 w-2/3 rounded bg-surface-container-high" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRooms.length ? (
          <div className="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-4">
            {filteredRooms.map((room) => (
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
                    <SecondaryButton type="button" className="flex-1 px-3 py-2 text-xs" onClick={() => setSelectedRoomId(room.id)}>
                      Preview
                    </SecondaryButton>
                    <SecondaryButton type="button" className="flex-1 px-3 py-2 text-xs" onClick={() => navigate(`/rooms/${room.id}`)}>
                      Open Room
                    </SecondaryButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <EmptyStateCard
              title="Tidak ada room untuk filter ini"
              description="Coba ubah kategori atau bersihkan search untuk melihat room publik lain yang sedang aktif."
            />
          </div>
        )}
      </ContentCard>
    </PageContainer>
  );
}

function BrowseStatCard({
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

function PreviewMetric({ label, value, icon }: { label: string; value: string; icon: string }) {
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

function CategorySummaryRow({
  label,
  count,
  viewers,
}: {
  label: string;
  count: number;
  viewers: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{count} room</p>
      </div>
      <span className="text-sm font-bold text-tertiary">{formatViewerCount(viewers)}</span>
    </div>
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

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <ContentCard className="p-8 text-center">
      <h3 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
      <p className="mt-3 text-sm text-on-surface-variant">{description}</p>
    </ContentCard>
  );
}

function buildCategoryHighlights(rooms: RoomView[]) {
  const grouped = new Map<string, { count: number; viewers: number }>();

  for (const room of rooms) {
    const label = room.category?.trim() || "Uncategorized";
    const current = grouped.get(label) ?? { count: 0, viewers: 0 };

    grouped.set(label, {
      count: current.count + 1,
      viewers: current.viewers + room.viewerCount,
    });
  }

  return Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      viewers: value.viewers,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
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

function shortHostId(hostId: string) {
  return hostId.slice(0, 4).toUpperCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Gagal mengambil browse catalog dari backend.";
}
