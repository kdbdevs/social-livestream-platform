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

type LiveSummary = {
  roomId: string;
  durationSeconds: number;
  peakViewers: number;
  totalDiamond: number;
  giftCount: number;
};

type AnalyticsRoom = RoomView & {
  summary: LiveSummary;
};

const STATUS_ORDER: AnalyticsRoom["status"][] = ["LIVE", "PUBLISHED", "DRAFT", "ENDED", "ARCHIVED"];

export function AnalyticsPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSession();
  const [rooms, setRooms] = useState<AnalyticsRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hostBlockedMessage, setHostBlockedMessage] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    void loadAnalyticsData(accessToken, controller.signal);

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const totals = useMemo(() => {
    const totalDiamonds = rooms.reduce((sum, room) => sum + room.summary.totalDiamond, 0);
    const totalGifts = rooms.reduce((sum, room) => sum + room.summary.giftCount, 0);
    const totalDurationSeconds = rooms.reduce((sum, room) => sum + room.summary.durationSeconds, 0);
    const activeRooms = rooms.filter((room) => room.status === "LIVE" || room.status === "PUBLISHED");
    const completedRooms = rooms.filter((room) => room.status === "ENDED" || room.status === "ARCHIVED");
    const totalViewerSnapshots = activeRooms.reduce((sum, room) => sum + room.viewerCount, 0);

    return {
      totalDiamonds,
      totalGifts,
      totalDurationSeconds,
      activeRooms: activeRooms.length,
      completedRooms: completedRooms.length,
      totalViewerSnapshots,
    };
  }, [rooms]);

  const featuredRoom = useMemo(() => {
    return (
      rooms.find((room) => room.status === "LIVE") ??
      rooms.find((room) => room.status === "PUBLISHED") ??
      [...rooms].sort((left, right) => {
        if (right.summary.totalDiamond !== left.summary.totalDiamond) {
          return right.summary.totalDiamond - left.summary.totalDiamond;
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })[0] ??
      null
    );
  }, [rooms]);

  const statusBreakdown = useMemo(
    () =>
      STATUS_ORDER.map((status) => {
        const count = rooms.filter((room) => room.status === status).length;

        return {
          status,
          count,
          ratio: rooms.length ? Math.round((count / rooms.length) * 100) : 0,
        };
      }).filter((item) => item.count > 0),
    [rooms],
  );

  const categoryBreakdown = useMemo(() => {
    const grouped = new Map<string, { count: number; diamonds: number }>();

    for (const room of rooms) {
      const key = room.category?.trim() || "Uncategorized";
      const current = grouped.get(key) ?? { count: 0, diamonds: 0 };
      grouped.set(key, {
        count: current.count + 1,
        diamonds: current.diamonds + room.summary.totalDiamond,
      });
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({
        label,
        count: value.count,
        diamonds: value.diamonds,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [rooms]);

  const topRooms = useMemo(
    () =>
      [...rooms]
        .sort((left, right) => {
          if (right.summary.totalDiamond !== left.summary.totalDiamond) {
            return right.summary.totalDiamond - left.summary.totalDiamond;
          }

          if (right.summary.giftCount !== left.summary.giftCount) {
            return right.summary.giftCount - left.summary.giftCount;
          }

          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        })
        .slice(0, 6),
    [rooms],
  );

  async function loadAnalyticsData(token: string, signal?: AbortSignal) {
    setIsLoading(true);
    setError("");
    setHostBlockedMessage("");

    try {
      const response = await apiRequest<{ rooms: RoomView[] }>("/rooms/my?limit=20", {
        token,
        signal,
      });

      const nextRooms = response.rooms;
      const summaries = await Promise.all(
        nextRooms.map((room) =>
          apiRequest<LiveSummary>(`/hosts/me/live-summary/${room.id}`, {
            token,
            signal,
          }),
        ),
      );

      const summariesByRoomId = new Map(summaries.map((summary) => [summary.roomId, summary]));

      setRooms(
        nextRooms.map((room) => ({
          ...room,
          summary: summariesByRoomId.get(room.id) ?? {
            roomId: room.id,
            durationSeconds: 0,
            peakViewers: 0,
            totalDiamond: 0,
            giftCount: 0,
          },
        })),
      );
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      if (loadError instanceof ApiError && loadError.code === "HOST_NOT_APPROVED") {
        setHostBlockedMessage(
          "Analytics host belum tersedia untuk akun ini karena backend hanya membuka data room untuk host yang sudah approved.",
        );
        setRooms([]);
      } else {
        setError(resolveErrorMessage(loadError));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    if (!accessToken) {
      return;
    }

    setIsRefreshing(true);

    try {
      await loadAnalyticsData(accessToken);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Host Tools"
        title="Analytics"
        description="Ringkasan performa stream yang benar-benar memakai data backend: daftar room host, lifecycle status, duration, gifts, diamonds, dan viewer snapshot untuk room yang masih aktif."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={handleRefresh} disabled={isLoading || isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh Analytics"}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => navigate("/go-live")}>
              Create New Room
            </PrimaryButton>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      {hostBlockedMessage ? (
        <EmptyAnalyticsState
          title="Host analytics belum bisa dibuka"
          description={hostBlockedMessage}
          actionLabel="Back to Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      ) : null}

      {!hostBlockedMessage ? (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsStatCard
              icon="video_library"
              title="Managed Rooms"
              value={isLoading ? "..." : String(rooms.length)}
              meta="Total room host yang bisa dibaca dari endpoint `/rooms/my`."
            />
            <AnalyticsStatCard
              icon="sensors"
              title="Live + Ready"
              value={isLoading ? "..." : String(totals.activeRooms)}
              meta="Room dengan status `LIVE` atau `PUBLISHED`."
            />
            <AnalyticsStatCard
              icon="diamond"
              title="Total Diamonds"
              value={isLoading ? "..." : formatCompactNumber(totals.totalDiamonds)}
              meta="Akumulasi diamond dari live summary semua room."
              accent
            />
            <AnalyticsStatCard
              icon="redeem"
              title="Gift Events"
              value={isLoading ? "..." : formatCompactNumber(totals.totalGifts)}
              meta="Jumlah transaksi gift sukses yang tercatat di room-room host."
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <ContentCard className="overflow-hidden p-0">
              <div className="border-b border-[rgb(64_72_93_/_0.18)] bg-[linear-gradient(135deg,rgba(18,32,60,0.96),rgba(9,18,37,0.92))] px-6 py-5">
                <SectionHeader
                  title="Featured Performance Snapshot"
                  description="Room yang diprioritaskan adalah yang LIVE, lalu PUBLISHED, lalu room dengan diamond tertinggi."
                />
              </div>

              {isLoading ? (
                <div className="grid gap-4 p-6">
                  <div className="h-24 rounded-xl bg-surface-container-high" />
                  <div className="h-24 rounded-xl bg-surface-container-high" />
                  <div className="h-48 rounded-xl bg-surface-container-high" />
                </div>
              ) : featuredRoom ? (
                <div className="grid gap-6 p-6">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Featured Room</p>
                          <h2 className="mt-3 truncate font-display text-3xl font-black tracking-tight text-on-surface">
                            {featuredRoom.title}
                          </h2>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            {featuredRoom.category || "Uncategorized"} · Updated {formatDateTime(featuredRoom.updatedAt)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusClassName(featuredRoom.status)}`}>
                          {featuredRoom.status}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                        {featuredRoom.description || "Room ini belum punya deskripsi. Analytics tetap dihitung dari lifecycle room dan transaksi gift yang tercatat."}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <CategoryChip active>{featuredRoom.category || "Uncategorized"}</CategoryChip>
                        <CategoryChip>{featuredRoom.giftEnabled ? "Gift Enabled" : "Gift Disabled"}</CategoryChip>
                        <CategoryChip>{featuredRoom.chatEnabled ? "Chat Enabled" : "Chat Disabled"}</CategoryChip>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <InsightMiniCard
                        label="Viewer Snapshot"
                        value={String(featuredRoom.viewerCount)}
                        meta="Nilai viewerCount yang tersedia di room aktif."
                        icon="groups"
                      />
                      <InsightMiniCard
                        label="Duration"
                        value={formatDuration(featuredRoom.summary.durationSeconds)}
                        meta="Total durasi yang backend berhasil hitung untuk room ini."
                        icon="timer"
                      />
                      <InsightMiniCard
                        label="Diamonds"
                        value={formatCompactNumber(featuredRoom.summary.totalDiamond)}
                        meta="Akumulasi reward diamond dari gift transaction sukses."
                        icon="diamond"
                        accent
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <ManagerMiniStat title="Gift Count" value={String(featuredRoom.summary.giftCount)} />
                    <ManagerMiniStat title="Completed Rooms" value={String(totals.completedRooms)} />
                    <ManagerMiniStat title="Viewer Snapshot Total" value={String(totals.totalViewerSnapshots)} />
                    <ManagerMiniStat title="Total Stream Time" value={formatDuration(totals.totalDurationSeconds)} emphasizeNumeric />
                  </div>

                  <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4 text-sm text-on-surface-variant">
                    Peak viewers belum tersedia secara historis di backend saat ini, jadi halaman ini sengaja fokus ke metrik yang benar-benar tersedia: lifecycle room, duration, gift count, diamond total, dan viewer snapshot untuk room aktif.
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <EmptyAnalyticsState
                    title="Belum ada room untuk dianalisis"
                    description="Buat room pertama kamu lewat Go Live. Setelah room tercipta, analytics akan mulai merangkum status, duration, gifts, dan diamonds."
                    actionLabel="Open Go Live"
                    onAction={() => navigate("/go-live")}
                    compact
                  />
                </div>
              )}
            </ContentCard>

            <div className="space-y-6">
              <ContentCard>
                <SectionHeader
                  title="Status Breakdown"
                  description="Distribusi room berdasarkan lifecycle status yang memang tersedia di backend."
                />
                <div className="mt-5 space-y-4">
                  {statusBreakdown.length ? (
                    statusBreakdown.map((item) => (
                      <BarMetric
                        key={item.status}
                        label={item.status}
                        value={`${item.count} room`}
                        ratio={item.ratio}
                        toneClassName={getStatusBarClassName(item.status)}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-on-surface-variant">Belum ada status breakdown untuk ditampilkan.</p>
                  )}
                </div>
              </ContentCard>

              <ContentCard>
                <SectionHeader
                  title="Category Mix"
                  description="Kategori diambil dari metadata room yang tersimpan saat setup."
                />
                <div className="mt-5 space-y-3">
                  {categoryBreakdown.length ? (
                    categoryBreakdown.map((category) => (
                      <div
                        key={category.label}
                        className="flex items-center justify-between rounded-xl border border-[rgb(64_72_93_/_0.2)] bg-surface-container-high px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{category.label}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{category.count} room</p>
                        </div>
                        <span className="text-sm font-bold text-tertiary">{formatCompactNumber(category.diamonds)} diamonds</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-on-surface-variant">Belum ada category mix untuk ditampilkan.</p>
                  )}
                </div>
              </ContentCard>
            </div>
          </section>

          <ContentCard className="p-0 overflow-hidden">
            <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
              <SectionHeader
                title="Top Performing Rooms"
                description="Urutan ditentukan dari diamond tertinggi, lalu gift count, lalu aktivitas terbaru."
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-[rgb(64_72_93_/_0.14)] text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                    <th className="px-6 py-4 font-bold">Room</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold">Duration</th>
                    <th className="px-6 py-4 font-bold">Viewer Snapshot</th>
                    <th className="px-6 py-4 font-bold">Gifts</th>
                    <th className="px-6 py-4 font-bold">Diamonds</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-sm text-on-surface-variant">
                        Loading analytics data...
                      </td>
                    </tr>
                  ) : topRooms.length ? (
                    topRooms.map((room) => (
                      <tr key={room.id} className="border-b border-[rgb(64_72_93_/_0.1)] last:border-b-0 hover:bg-surface-container-high/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.12)] text-primary">
                              <MaterialIcon name={room.status === "LIVE" ? "radio_button_checked" : "bar_chart"} className="text-[18px]" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-on-surface">{room.title}</p>
                              <p className="truncate text-xs text-on-surface-variant">{room.category || "Uncategorized"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getStatusClassName(room.status)}`}>
                            {room.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDuration(room.summary.durationSeconds)}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-on-surface">{room.viewerCount}</td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">{room.summary.giftCount}</td>
                        <td className="px-6 py-4 text-sm font-bold text-tertiary">{formatCompactNumber(room.summary.totalDiamond)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-sm text-on-surface-variant">
                        Belum ada room yang bisa diranking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ContentCard>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <ContentCard>
              <SectionHeader
                title="Recent Analytics Rows"
                description="Snapshot room terbaru agar host cepat membaca performa per sesi."
              />
              <div className="mt-5 space-y-3">
                {rooms.length ? (
                  rooms.slice(0, 6).map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => navigate("/stream-manager")}
                      className="flex w-full items-center gap-3 rounded-xl border border-[rgb(64_72_93_/_0.2)] bg-surface-container-high p-4 text-left transition hover:bg-surface-container"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
                        <MaterialIcon name="analytics" className="text-xl" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-on-surface">{room.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Updated {formatDateTime(room.updatedAt)} · {room.summary.giftCount} gifts · {formatCompactNumber(room.summary.totalDiamond)} diamonds
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-on-surface-variant">{formatDuration(room.summary.durationSeconds)}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-on-surface-variant">Belum ada analytics row untuk ditampilkan.</p>
                )}
              </div>
            </ContentCard>

            <ContentCard>
              <SectionHeader
                title="Backend Coverage"
                description="Panel ini menjelaskan dengan jujur metrik mana yang sudah tersedia sekarang."
              />
              <div className="mt-5 space-y-3">
                <CoverageRow icon="check_circle" title="Room lifecycle" description="Tersedia dari `/rooms/my` lewat status DRAFT, PUBLISHED, LIVE, ENDED, dan ARCHIVED." />
                <CoverageRow icon="check_circle" title="Diamonds & gifts" description="Tersedia dari `/hosts/me/live-summary/:roomId` melalui aggregate gift transaction sukses." />
                <CoverageRow icon="check_circle" title="Duration" description="Tersedia jika room punya kombinasi `startedAt` dan `endedAt` yang valid di backend." />
                <CoverageRow icon="check_circle" title="Viewer snapshot" description="Tersedia sebagai `viewerCount` di room aktif, dipakai sebagai snapshot, bukan historical peak." />
                <CoverageRow icon="schedule" title="Peak viewers historical" description="Belum tersedia dari backend sekarang, jadi halaman ini tidak menampilkan angka palsu untuk metrik itu." subtle />
              </div>
            </ContentCard>
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}

function AnalyticsStatCard({
  icon,
  title,
  value,
  meta,
  accent = false,
}: {
  icon: string;
  title: string;
  value: string;
  meta: string;
  accent?: boolean;
}) {
  return (
    <ContentCard className="bg-surface-container transition hover:bg-surface-container-high">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.12)] text-primary">
        <MaterialIcon name={icon} filled={icon === "diamond"} className="text-[22px]" />
      </div>
      <p className="mt-5 text-sm font-medium text-on-surface-variant">{title}</p>
      <p className={`mt-2 font-display text-3xl font-black tracking-tight text-on-surface ${accent ? "text-tertiary" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </ContentCard>
  );
}

function InsightMiniCard({
  label,
  value,
  meta,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  meta: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(186_158_255_/_0.12)] text-primary">
          <MaterialIcon name={icon} filled={icon === "diamond"} className="text-lg" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      </div>
      <p className={`mt-4 text-2xl font-black text-on-surface ${accent ? "text-tertiary" : ""}`}>{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{meta}</p>
    </div>
  );
}

function ManagerMiniStat({
  title,
  value,
  emphasizeNumeric = false,
}: {
  title: string;
  value: string;
  emphasizeNumeric?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{title}</p>
      <p className={`mt-3 font-display font-black tracking-tight text-on-surface ${emphasizeNumeric ? "font-mono text-[1.35rem]" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}

function BarMetric({
  label,
  value,
  ratio,
  toneClassName,
}: {
  label: string;
  value: string;
  ratio: number;
  toneClassName: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-on-surface">{label}</span>
        <span className="text-xs font-medium text-on-surface-variant">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
        <div className={`h-full rounded-full ${toneClassName}`} style={{ width: `${Math.max(ratio, ratio ? 8 : 0)}%` }} />
      </div>
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

function EmptyAnalyticsState({
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

function getStatusClassName(status: AnalyticsRoom["status"]) {
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

function getStatusBarClassName(status: AnalyticsRoom["status"]) {
  switch (status) {
    case "LIVE":
      return "bg-error";
    case "PUBLISHED":
      return "bg-tertiary";
    case "ENDED":
      return "bg-[rgb(126_211_255)]";
    case "ARCHIVED":
      return "bg-[rgb(104_118_152)]";
    default:
      return "bg-primary";
  }
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
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

  return "Terjadi kesalahan tak terduga saat memuat analytics.";
}
