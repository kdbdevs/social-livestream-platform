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

type BroadcastConfig = {
  roomId: string;
  ingestUrl: string;
  streamKey: string;
  playbackUrl: string;
  roomStatus: RoomView["status"];
};

type LiveSummary = {
  roomId: string;
  durationSeconds: number;
  peakViewers: number;
  totalDiamond: number;
  giftCount: number;
};

type RemoveRoomResult = {
  roomId: string;
  status: RoomView["status"];
  outcome: "DELETED" | "ARCHIVED";
};

export function StreamManagerPage() {
  const navigate = useNavigate();
  const { accessToken } = useSession();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomView | null>(null);
  const [broadcastConfig, setBroadcastConfig] = useState<BroadcastConfig | null>(null);
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingRoomAction, setPendingRoomAction] = useState<{ roomId: string; action: "end" | "remove" } | null>(null);
  const [isStreamKeyVisible, setIsStreamKeyVisible] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "ingest" | "streamKey" | "playback">("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    void loadManagerData(accessToken, controller.signal);

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const statusClassName = getRoomStatusClassName(activeRoom?.status ?? "DRAFT");
  const topStats = useMemo(
    () => [
      {
        label: "Current Status",
        value: activeRoom?.status ?? "No room",
        icon: activeRoom?.status === "LIVE" ? "sensors" : activeRoom?.status === "PUBLISHED" ? "podcasts" : "draft",
        valueClassName: activeRoom?.status === "LIVE" ? "text-error" : activeRoom?.status === "PUBLISHED" ? "text-tertiary" : "text-primary",
      },
      {
        label: "Peak Viewers",
        value: String(liveSummary?.peakViewers ?? activeRoom?.viewerCount ?? 0),
        icon: "groups",
      },
      {
        label: "Diamonds",
        value: String(liveSummary?.totalDiamond ?? 0),
        icon: "diamond",
        valueClassName: "text-tertiary",
      },
    ],
    [activeRoom?.status, activeRoom?.viewerCount, liveSummary?.peakViewers, liveSummary?.totalDiamond],
  );

  async function loadManagerData(token: string, signal?: AbortSignal, preferredRoomId?: string) {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest<{ rooms: RoomView[] }>("/rooms/my?limit=20", {
        token,
        signal,
      });
      const nextRooms = response.rooms;
      const preferredRoom =
        (preferredRoomId ? nextRooms.find((item) => item.id === preferredRoomId) : null) ??
        nextRooms.find((item) => item.status === "LIVE") ??
        nextRooms.find((item) => item.status === "PUBLISHED") ??
        nextRooms.find((item) => item.status === "DRAFT") ??
        nextRooms[0] ??
        null;

      setRooms(nextRooms);
      setActiveRoom(preferredRoom);

      if (!preferredRoom) {
        setBroadcastConfig(null);
        setLiveSummary(null);
        return;
      }

      const config = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${preferredRoom.id}`, {
        token,
        signal,
      });
      setBroadcastConfig(config);

      const summary = await apiRequest<LiveSummary>(`/hosts/me/live-summary/${preferredRoom.id}`, {
        token,
        signal,
      });
      setLiveSummary(summary);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(resolveErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    if (!accessToken) {
      return;
    }

    setIsRefreshing(true);
    setSuccess("");
    setError("");

    try {
      await loadManagerData(accessToken, undefined, activeRoom?.id);
      setSuccess("Status room dan koneksi OBS berhasil diperbarui.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleFocusRoom(targetRoom: RoomView) {
    if (!accessToken) {
      setActiveRoom(targetRoom);
      return;
    }

    setSuccess("");
    setError("");
    await loadManagerData(accessToken, undefined, targetRoom.id);
  }

  async function handleEndRoom(targetRoom: RoomView | null = activeRoom) {
    if (!accessToken || !targetRoom || !canEndRoom(targetRoom.status)) {
      return;
    }

    setPendingRoomAction({ roomId: targetRoom.id, action: "end" });
    setError("");
    setSuccess("");

    try {
      await apiRequest<{ roomId: string; status: RoomView["status"] }>(`/rooms/${targetRoom.id}/end`, {
        method: "POST",
        token: accessToken,
      });

      await loadManagerData(accessToken);
      setSuccess(`Room "${targetRoom.title}" berhasil diakhiri. Sekarang kamu bisa lanjut setup sesi berikutnya atau hapus room ini dari daftar.`);
    } catch (endError) {
      setError(resolveErrorMessage(endError));
    } finally {
      setPendingRoomAction(null);
    }
  }

  async function handleRemoveRoom(targetRoom: RoomView) {
    if (!accessToken || !canRemoveRoom(targetRoom.status)) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus room "${targetRoom.title}" dari daftar host? Room LIVE atau PUBLISHED harus di-end dulu sebelum bisa dihapus.`,
    );

    if (!confirmed) {
      return;
    }

    setPendingRoomAction({ roomId: targetRoom.id, action: "remove" });
    setError("");
    setSuccess("");

    try {
      const result = await apiRequest<RemoveRoomResult>(`/rooms/${targetRoom.id}`, {
        method: "DELETE",
        token: accessToken,
      });

      await loadManagerData(accessToken);
      setSuccess(
        result.outcome === "DELETED"
          ? `Room "${targetRoom.title}" berhasil dihapus.`
          : `Room "${targetRoom.title}" tidak bisa dihapus permanen karena sudah punya histori transaksi, jadi dipindahkan ke arsip.`,
      );
    } catch (removeError) {
      setError(resolveErrorMessage(removeError));
    } finally {
      setPendingRoomAction(null);
    }
  }

  function handleCopy(value: string, target: "ingest" | "streamKey" | "playback") {
    void navigator.clipboard.writeText(value).then(() => {
      setCopyState(target);
      window.setTimeout(() => {
        setCopyState("idle");
      }, 1500);
    });
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Host Tools"
        title="Stream Manager"
        description="Kelola room aktif, pantau status OBS, dan tangani live state yang nyangkut tanpa keluar dari unified account shell."
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={handleRefresh} disabled={isLoading || isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh Status"}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => navigate("/go-live")}>
              Open Go Live Setup
            </PrimaryButton>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-[rgb(255_110_132_/_0.28)] bg-[rgb(167_1_56_/_0.22)] px-4 py-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-[rgb(105_246_184_/_0.24)] bg-[rgb(105_246_184_/_0.12)] px-4 py-3 text-sm text-tertiary">
          {success}
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-3">
        {topStats.map((stat) => (
          <ContentCard key={stat.label} className="bg-surface-container transition hover:bg-surface-container-high">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.12)] text-primary">
                <MaterialIcon name={stat.icon} filled={stat.icon === "diamond"} className="text-[22px]" />
              </div>
              {stat.label === "Current Status" && activeRoom ? (
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusClassName}`}>
                  {activeRoom.status}
                </span>
              ) : null}
            </div>
            <p className="mt-5 text-sm font-medium text-on-surface-variant">{stat.label}</p>
            <p className={`mt-2 font-display text-3xl font-black tracking-tight text-on-surface ${stat.valueClassName ?? ""}`}>
              {stat.value}
            </p>
          </ContentCard>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
        <ContentCard className="p-0 overflow-hidden">
          <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
            <SectionHeader
              title="Active Room Overview"
              description="Room yang diprioritaskan di sini adalah LIVE, lalu PUBLISHED, lalu DRAFT."
            />
          </div>

          {isLoading ? (
            <div className="grid gap-4 p-6">
              <div className="h-20 rounded-xl bg-background/70" />
              <div className="h-20 rounded-xl bg-background/70" />
              <div className="h-48 rounded-xl bg-background/70" />
            </div>
          ) : activeRoom ? (
            <div className="grid gap-6 p-6">
              <div className="grid gap-5">
                <div className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-background">
                  {activeRoom.coverImageUrl ? (
                    <img src={activeRoom.coverImageUrl} alt={activeRoom.title} className="aspect-video h-full w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-[linear-gradient(135deg,rgba(15,25,48,0.94),rgba(20,31,56,0.88))]">
                      <div className="text-center">
                        <MaterialIcon name="live_tv" className="mx-auto text-3xl text-on-surface-variant" />
                        <p className="mt-2 text-sm text-on-surface-variant">No cover image</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Current Session</p>
                      <h2 className="mt-3 line-clamp-2 font-display text-[1.65rem] font-black tracking-tight text-on-surface">
                        {activeRoom.title}
                      </h2>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getRoomStatusClassName(activeRoom.status)}`}>
                      {activeRoom.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {activeRoom.description || "No description provided yet."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <MetaTile label="Category" value={activeRoom.category || "Uncategorized"} icon="category" />
                    <MetaTile label="Playback" value={activeRoom.playbackUrl ? "Ready" : "Waiting"} icon="live_tv" />
                    <MetaTile label="Updated" value={formatDateTime(activeRoom.updatedAt)} icon="schedule" />
                    <MetaTile label="Room ID" value={activeRoom.id} icon="fingerprint" mono />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ManagerMiniStat title="Duration" value={formatDuration(liveSummary?.durationSeconds ?? 0)} emphasizeNumeric />
                <ManagerMiniStat title="Peak Viewers" value={String(liveSummary?.peakViewers ?? 0)} />
                <ManagerMiniStat title="Gifts" value={String(liveSummary?.giftCount ?? 0)} />
                <ManagerMiniStat title="Diamonds" value={String(liveSummary?.totalDiamond ?? 0)} accent />
              </div>

              <div className="flex flex-wrap gap-3">
                <PrimaryButton type="button" onClick={() => navigate("/go-live")}>
                  Resume Go Live Setup
                </PrimaryButton>
                {activeRoom.playbackUrl ? (
                  <SecondaryButton type="button" onClick={() => window.open(activeRoom.playbackUrl ?? "", "_blank", "noopener,noreferrer")}>
                    Open Playback
                  </SecondaryButton>
                ) : null}
                {canEndRoom(activeRoom.status) ? (
                  <SecondaryButton
                    type="button"
                    onClick={() => void handleEndRoom(activeRoom)}
                    disabled={isPendingRoomAction(pendingRoomAction, activeRoom.id, "end")}
                  >
                    {isPendingRoomAction(pendingRoomAction, activeRoom.id, "end") ? "Ending..." : "End Room"}
                  </SecondaryButton>
                ) : null}
                {canRemoveRoom(activeRoom.status) ? (
                  <SecondaryButton
                    type="button"
                    onClick={() => void handleRemoveRoom(activeRoom)}
                    disabled={isPendingRoomAction(pendingRoomAction, activeRoom.id, "remove")}
                  >
                    {isPendingRoomAction(pendingRoomAction, activeRoom.id, "remove") ? "Removing..." : "Delete Room"}
                  </SecondaryButton>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-on-surface-variant">
              Belum ada room host. Buka menu `Go Live` untuk membuat setup stream pertama kamu.
            </div>
          )}
        </ContentCard>

        <div className="space-y-6">
          <ContentCard className="bg-surface-container-high p-6">
            <SectionHeader
              title="OBS Connection"
              description="Gunakan panel ini untuk memastikan room aktif dan kredensial OBS selalu sinkron."
            />

            {broadcastConfig ? (
              <div className="mt-5 space-y-4">
                <ReadonlyManagerField
                  label="RTMP Server URL"
                  value={broadcastConfig.ingestUrl}
                  actionLabel={copyState === "ingest" ? "Copied" : "Copy"}
                  onAction={() => handleCopy(broadcastConfig.ingestUrl, "ingest")}
                />
                <ReadonlyManagerField
                  label="Stream Key"
                  value={broadcastConfig.streamKey}
                  masked={!isStreamKeyVisible}
                  actionLabel={copyState === "streamKey" ? "Copied" : "Copy"}
                  onAction={() => handleCopy(broadcastConfig.streamKey, "streamKey")}
                  secondaryAction={
                    <button
                      type="button"
                      onClick={() => setIsStreamKeyVisible((current) => !current)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
                    >
                      <MaterialIcon name={isStreamKeyVisible ? "visibility_off" : "visibility"} className="text-[18px]" />
                    </button>
                  }
                />
                <ReadonlyManagerField
                  label="Playback URL"
                  value={broadcastConfig.playbackUrl}
                  actionLabel={copyState === "playback" ? "Copied" : "Copy"}
                  onAction={() => handleCopy(broadcastConfig.playbackUrl, "playback")}
                />

                <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-background/80 p-4 text-sm text-on-surface-variant">
                  Jika kamu melihat pesan bahwa host masih punya room LIVE, halaman ini membantu kamu menemukan room itu dan menutupnya dengan aman.
                </div>
              </div>
            ) : (
              <div className="mt-5 text-sm text-on-surface-variant">Belum ada connection snapshot untuk ditampilkan.</div>
            )}
          </ContentCard>

          <ContentCard className="p-6">
            <SectionHeader title="Quick Actions" description="Akses cepat untuk menangani room aktif atau lanjut setup baru." />
            <div className="mt-5 grid gap-3">
              <SecondaryButton type="button" onClick={() => navigate("/go-live")}>
                Edit Stream Metadata
              </SecondaryButton>
              <SecondaryButton type="button" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Check Current Status"}
              </SecondaryButton>
              {activeRoom && canEndRoom(activeRoom.status) ? (
                <PrimaryButton
                  type="button"
                  onClick={() => void handleEndRoom(activeRoom)}
                  disabled={isPendingRoomAction(pendingRoomAction, activeRoom.id, "end")}
                >
                  {isPendingRoomAction(pendingRoomAction, activeRoom.id, "end") ? "Ending..." : "Force End Current Session"}
                </PrimaryButton>
              ) : (
                <PrimaryButton type="button" onClick={() => navigate("/go-live")}>
                  Prepare Next Stream
                </PrimaryButton>
              )}
            </div>
          </ContentCard>
        </div>
      </section>

      <ContentCard className="p-0 overflow-hidden">
        <div className="border-b border-[rgb(64_72_93_/_0.18)] px-6 py-5">
          <SectionHeader
            title="Recent Rooms"
            description="Daftar room host terbaru untuk cek status dan jalankan aksi cepat seperti focus, end stream, atau delete room."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[rgb(64_72_93_/_0.14)] text-xs uppercase tracking-[0.18em] text-on-surface-variant">
                <th className="px-6 py-4 font-bold">Room</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Updated</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length ? (
                rooms.map((item) => (
                  <tr key={item.id} className="border-b border-[rgb(64_72_93_/_0.1)] last:border-b-0 hover:bg-surface-container-high/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-container-high text-primary">
                          <MaterialIcon name={item.status === "LIVE" ? "radio_button_checked" : "live_tv"} className="text-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">{item.title}</p>
                          <p className="truncate text-xs text-on-surface-variant">{item.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.category || "-"}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getRoomStatusClassName(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <TableActionButton
                          label="Focus"
                          onClick={() => void handleFocusRoom(item)}
                        />
                        {canEndRoom(item.status) ? (
                          <TableActionButton
                            label={isPendingRoomAction(pendingRoomAction, item.id, "end") ? "Ending..." : "End"}
                            onClick={() => void handleEndRoom(item)}
                            disabled={isPendingRoomAction(pendingRoomAction, item.id, "end")}
                            destructive
                          />
                        ) : null}
                        {canRemoveRoom(item.status) ? (
                          <TableActionButton
                            label={isPendingRoomAction(pendingRoomAction, item.id, "remove") ? "Removing..." : "Delete"}
                            onClick={() => void handleRemoveRoom(item)}
                            disabled={isPendingRoomAction(pendingRoomAction, item.id, "remove")}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-sm text-on-surface-variant">
                    Belum ada room untuk dikelola.
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

function ManagerMiniStat({
  title,
  value,
  accent = false,
  emphasizeNumeric = false,
}: {
  title: string;
  value: string;
  accent?: boolean;
  emphasizeNumeric?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{title}</p>
      <p
        className={`mt-3 break-words font-display font-black tracking-tight text-on-surface ${
          emphasizeNumeric ? "font-mono text-[1.35rem] tabular-nums md:text-[1.55rem]" : "text-2xl"
        } ${accent ? "text-tertiary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`text-right text-on-surface ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function MetaTile({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[rgb(64_72_93_/_0.18)] bg-background/60 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(186_158_255_/_0.1)] text-primary">
          <MaterialIcon name={icon} className="text-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
          <p className={`mt-1 break-words text-sm text-on-surface ${mono ? "font-mono text-[12px]" : "font-medium"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReadonlyManagerField({
  label,
  value,
  actionLabel,
  masked = false,
  secondaryAction,
  onAction,
}: {
  label: string;
  value: string;
  actionLabel: string;
  masked?: boolean;
  secondaryAction?: React.ReactNode;
  onAction: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-background/80 p-2">
        <input
          readOnly
          value={masked ? maskSecret(value) : value}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm text-on-surface outline-none"
        />
        {secondaryAction}
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-primary transition hover:bg-surface-container-high"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function TableActionButton({
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        destructive
          ? "border-[rgb(255_110_132_/_0.22)] bg-[rgb(255_110_132_/_0.08)] text-error hover:bg-[rgb(255_110_132_/_0.14)]"
          : "border-[rgb(64_72_93_/_0.24)] bg-surface-container-high text-on-surface hover:bg-surface-container"
      }`}
    >
      {label}
    </button>
  );
}

function getRoomStatusClassName(status: RoomView["status"]) {
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

function canEndRoom(status: RoomView["status"]) {
  return status === "LIVE" || status === "PUBLISHED";
}

function canRemoveRoom(status: RoomView["status"]) {
  return status !== "LIVE" && status !== "PUBLISHED";
}

function isPendingRoomAction(
  pendingRoomAction: { roomId: string; action: "end" | "remove" } | null,
  roomId: string,
  action: "end" | "remove",
) {
  return pendingRoomAction?.roomId === roomId && pendingRoomAction.action === action;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
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
    if (error.code === "HOST_NOT_APPROVED") {
      return "Akun ini belum approved sebagai host. Gunakan akun host yang sudah approved atau selesaikan approval host terlebih dahulu.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan tak terduga.";
}

function maskSecret(value: string) {
  if (value.length <= 8) {
    return "•".repeat(value.length);
  }

  return `${value.slice(0, 4)}${"•".repeat(Math.max(6, value.length - 8))}${value.slice(-4)}`;
}
