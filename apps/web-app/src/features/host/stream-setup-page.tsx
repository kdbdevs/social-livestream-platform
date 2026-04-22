import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
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

type ThumbnailMode = "upload" | "url";

const categoryOptions = [
  "Science & Technology",
  "Gaming",
  "Just Chatting",
  "Music",
  "Esports",
  "Creative Arts",
];

const defaultFormState = {
  title: "Late Night Coding & Chill - Building a UI Component Library",
  description: "Shipping UI pieces live, talking through decisions, and polishing the experience for tomorrow's release.",
  category: "Science & Technology",
  chatEnabled: true,
  giftEnabled: true,
};

export function StreamSetupPage({ mode = "go-live" }: { mode?: "go-live" | "stream-manager" }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { accessToken, user } = useSession();
  const [room, setRoom] = useState<RoomView | null>(null);
  const [broadcastConfig, setBroadcastConfig] = useState<BroadcastConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEndingRoom, setIsEndingRoom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isStreamKeyVisible, setIsStreamKeyVisible] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "ingest" | "streamKey" | "playback">("idle");
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>("upload");
  const [uploadedThumbnailName, setUploadedThumbnailName] = useState("");
  const [form, setForm] = useState({
    ...defaultFormState,
    coverImageUrl: "",
    imageUrlInput: "",
  });

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const token = accessToken;
    let isMounted = true;
    const controller = new AbortController();

    async function loadActiveRoom() {
      setIsLoading(true);
      setError("");

      try {
        const activeRoom = await resolveActiveRoom(token, controller.signal);

        const config = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${activeRoom.id}`, {
          token,
          signal: controller.signal,
        });

        if (!isMounted) {
          return;
        }

        applyRoomToForm(activeRoom);
        setRoom(activeRoom);
        setBroadcastConfig(config);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (!isMounted) {
          return;
        }

        setError(resolveErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadActiveRoom();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [accessToken]);

  const pageMeta = useMemo(
    () =>
      mode === "stream-manager"
        ? {
            eyebrow: "Host Tools",
            title: "Stream Manager",
            description: "Manage the current draft room, OBS connection details, and publish flow without leaving the unified account shell.",
          }
        : {
            eyebrow: "Host Tools",
            title: "Live Setup",
            description: "Configure stream metadata, thumbnail, and OBS settings before you publish your next live room.",
          },
    [mode],
  );

  const thumbnailPreviewUrl = thumbnailMode === "url" ? form.imageUrlInput.trim() : form.coverImageUrl;
  const isRoomReady = Boolean(room && broadcastConfig);
  const isEditable = room?.status === "DRAFT";
  const statusPillClassName = getRoomStatusClassName(broadcastConfig?.roomStatus ?? room?.status ?? "DRAFT");
  const primaryActionLabel =
    room?.status === "LIVE" ? "Room Live" : room?.status === "PUBLISHED" ? "Ready in OBS" : "Publish Room";

  async function handleSaveDraft() {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const ensuredRoom = await persistDraftRoom(accessToken);
      setSuccess(`Draft room "${ensuredRoom.title}" berhasil disimpan.`);
    } catch (saveError) {
      setError(resolveErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublishRoom() {
    if (!accessToken) {
      return;
    }

    if (room?.status === "LIVE") {
      setSuccess("Room ini sudah berstatus LIVE. Gunakan kredensial OBS yang sama atau akhiri room ini terlebih dahulu.");
      return;
    }

    if (room?.status === "PUBLISHED") {
      setSuccess("Room ini sudah berstatus PUBLISHED. Gunakan RTMP URL dan stream key di panel kanan untuk mulai stream dari OBS.");
      return;
    }

    setIsPublishing(true);
    setError("");
    setSuccess("");

    try {
      const ensuredRoom = await persistDraftRoom(accessToken);
      const published = await apiRequest<{ roomId: string; status: RoomView["status"] }>(`/rooms/${ensuredRoom.id}/publish`, {
        method: "POST",
        token: accessToken,
      });
      const config = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${ensuredRoom.id}`, {
        token: accessToken,
      });
      setBroadcastConfig(config);
      setRoom((current) =>
        current
          ? {
              ...current,
              status: published.status,
              playbackUrl: config.playbackUrl,
            }
          : current,
      );
      setSuccess("Room berhasil dipublish. OBS sekarang bisa connect menggunakan RTMP URL dan stream key di panel kanan.");
    } catch (publishError) {
      setError(resolveErrorMessage(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleEndRoom() {
    if (!accessToken || !room) {
      return;
    }

    setIsEndingRoom(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest<{ roomId: string; status: RoomView["status"] }>(`/rooms/${room.id}/end`, {
        method: "POST",
        token: accessToken,
      });

      const nextRoom = await resolveActiveRoom(accessToken);
      const nextConfig = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${nextRoom.id}`, {
        token: accessToken,
      });

      setRoom(nextRoom);
      setBroadcastConfig(nextConfig);
      applyRoomToForm(nextRoom);
      setSuccess("Room sebelumnya berhasil diakhiri. Draft baru sudah siap untuk setup berikutnya.");
    } catch (endError) {
      setError(resolveErrorMessage(endError));
    } finally {
      setIsEndingRoom(false);
    }
  }

  async function persistDraftRoom(token: string) {
    const payload = buildRoomPayload(form);

    if (!room) {
      const created = await apiRequest<{ room: RoomView }>("/rooms", {
        method: "POST",
        token,
        body: payload,
      });

      setRoom(created.room);
      applyRoomToForm(created.room);

      const config = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${created.room.id}`, {
        token,
      });
      setBroadcastConfig(config);

      return created.room;
    }

    if (room.status !== "DRAFT") {
      return room;
    }

    const updated = await apiRequest<{ room: RoomView }>(`/rooms/${room.id}`, {
      method: "PATCH",
      token,
      body: payload,
    });
    setRoom(updated.room);
    applyRoomToForm(updated.room);

    if (!broadcastConfig || broadcastConfig.roomId !== updated.room.id) {
      const config = await apiRequest<BroadcastConfig>(`/host/broadcast/config?roomId=${updated.room.id}`, {
        token,
      });
      setBroadcastConfig(config);
    }

    return updated.room;
  }

  function applyRoomToForm(nextRoom: RoomView) {
    setForm((current) => ({
      ...current,
      title: nextRoom.title,
      description: nextRoom.description ?? "",
      category: nextRoom.category ?? defaultFormState.category,
      chatEnabled: nextRoom.chatEnabled,
      giftEnabled: nextRoom.giftEnabled,
      coverImageUrl: nextRoom.coverImageUrl ?? "",
      imageUrlInput: nextRoom.coverImageUrl?.startsWith("http") ? nextRoom.coverImageUrl : "",
    }));

    if (nextRoom.coverImageUrl?.startsWith("http")) {
      setThumbnailMode("url");
      setUploadedThumbnailName("");
      return;
    }

    if (nextRoom.coverImageUrl) {
      setThumbnailMode("upload");
      return;
    }

    setThumbnailMode("upload");
    setUploadedThumbnailName("");
  }

  async function handleThumbnailDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await applyThumbnailFile(file);
  }

  async function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await applyThumbnailFile(file);
  }

  async function applyThumbnailFile(file: File) {
    setError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format thumbnail harus JPEG, PNG, atau WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran thumbnail maksimal 5MB.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setThumbnailMode("upload");
    setUploadedThumbnailName(file.name);
    setForm((current) => ({
      ...current,
      coverImageUrl: dataUrl,
      imageUrlInput: "",
    }));
  }

  function handleImageUrlApply() {
    const sanitizedUrl = form.imageUrlInput.trim();

    if (!sanitizedUrl) {
      setError("Masukkan URL gambar terlebih dahulu.");
      return;
    }

    try {
      new URL(sanitizedUrl);
    } catch {
      setError("URL gambar tidak valid.");
      return;
    }

    setError("");
    setThumbnailMode("url");
    setUploadedThumbnailName("");
    setForm((current) => ({
      ...current,
      coverImageUrl: sanitizedUrl,
      imageUrlInput: sanitizedUrl,
    }));
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
        eyebrow={pageMeta.eyebrow}
        title={pageMeta.title}
        description={pageMeta.description}
        actions={
          <div className="flex flex-wrap gap-3">
            <SecondaryButton type="button" onClick={() => navigate("/dashboard")}>
              Dashboard
            </SecondaryButton>
            {room && (room.status === "LIVE" || room.status === "PUBLISHED") ? (
              <SecondaryButton type="button" onClick={handleEndRoom} disabled={isEndingRoom || isLoading}>
                {isEndingRoom ? "Ending..." : "End Room"}
              </SecondaryButton>
            ) : null}
            <PrimaryButton type="button" onClick={handlePublishRoom} disabled={!isRoomReady || isPublishing || isLoading}>
              {isPublishing ? "Publishing..." : primaryActionLabel}
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

      {room?.status === "DRAFT" ? (
        <div className="rounded-xl border border-[rgb(186_158_255_/_0.28)] bg-[rgb(186_158_255_/_0.08)] px-4 py-4 text-sm text-on-surface">
          <p className="font-semibold text-primary">Next step: Publish Room</p>
          <p className="mt-1 text-on-surface-variant">
            Room ini masih <code>DRAFT</code>. Setelah metadata siap, tekan <code>Publish Room</code> agar backend room state
            berubah menjadi <code>PUBLISHED</code> dan stream key bisa dipakai oleh OBS.
          </p>
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-8">
          <ContentCard className="relative overflow-hidden p-7 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(186,158,255,0.08),transparent_32%)]" />
            <div className="relative">
              <div className="mb-6 flex items-center gap-2">
                <MaterialIcon name="info" className="text-primary" />
                <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">General Info</h2>
              </div>

              <div className="space-y-5">
                <FieldBlock label="Stream Title" required>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    disabled={!isEditable}
                    className="h-12 w-full rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-background px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.2)]"
                    placeholder="Write a strong title for your broadcast"
                  />
                </FieldBlock>

                <FieldBlock label="Description">
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    disabled={!isEditable}
                    rows={4}
                    className="w-full rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.2)]"
                    placeholder="Tell viewers what this session is about"
                  />
                </FieldBlock>

                <div className="grid gap-5 md:grid-cols-2">
                  <FieldBlock label="Category">
                    <div className="relative">
                      <select
                        value={form.category}
                        onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                        disabled={!isEditable}
                        className="h-12 w-full appearance-none rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-background px-4 text-sm text-on-surface outline-none transition focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.2)]"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <MaterialIcon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    </div>
                  </FieldBlock>

                  <FieldBlock label="Room Status">
                    <div className="flex h-12 items-center justify-between rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-background px-4">
                      <span className="text-sm text-on-surface-variant">Backend room state</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${statusPillClassName}`}>
                        {broadcastConfig?.roomStatus ?? room?.status ?? "Loading"}
                      </span>
                    </div>
                  </FieldBlock>
                </div>

                <FieldBlock label="Stream Thumbnail">
                  <div className="space-y-4">
                    {!isEditable ? (
                      <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
                        Metadata terkunci karena room ini sudah {room?.status}. Jika ingin mengganti judul, deskripsi, kategori, atau thumbnail,
                        akhiri room aktif dulu agar draft baru dibuat.
                      </div>
                    ) : null}
                    <div className="inline-flex rounded-full border border-[rgb(64_72_93_/_0.28)] bg-surface-container-low p-1">
                      <button
                        type="button"
                        onClick={() => setThumbnailMode("upload")}
                        disabled={!isEditable}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          thumbnailMode === "upload" ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant"
                        }`}
                      >
                        Drag & Drop
                      </button>
                      <button
                        type="button"
                        onClick={() => setThumbnailMode("url")}
                        disabled={!isEditable}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          thumbnailMode === "url" ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant"
                        }`}
                      >
                        Image URL
                      </button>
                    </div>

                    {thumbnailMode === "upload" ? (
                      <label
                        onDragOver={(event) => {
                          if (!isEditable) {
                            return;
                          }
                          event.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleThumbnailDrop}
                        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                          isEditable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                        } ${
                          isDragging
                            ? "border-[rgb(186_158_255_/_0.56)] bg-[rgb(186_158_255_/_0.08)]"
                            : "border-[rgb(64_72_93_/_0.28)] bg-background/70 hover:border-[rgb(186_158_255_/_0.4)] hover:bg-background"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={!isEditable}
                          onChange={handleThumbnailChange}
                        />
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-primary">
                          <MaterialIcon name="cloud_upload" className="text-3xl" />
                        </div>
                        <h3 className="text-base font-semibold text-on-surface">Drag and drop an image</h3>
                        <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                          JPEG, PNG, atau WebP. Maksimal 5MB. File akan dikonversi ke thumbnail room dan langsung tersimpan ke backend saat draft disimpan.
                        </p>
                        <span className="mt-4 inline-flex rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-surface-container px-4 py-2 text-sm font-semibold text-primary">
                          Browse Files
                        </span>
                        {uploadedThumbnailName ? <p className="mt-3 text-xs text-tertiary">Selected: {uploadedThumbnailName}</p> : null}
                      </label>
                    ) : (
                      <div className="rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-background/80 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            value={form.imageUrlInput}
                            onChange={(event) => setForm((current) => ({ ...current, imageUrlInput: event.target.value }))}
                            disabled={!isEditable}
                            placeholder="https://images.example.com/cover.jpg"
                            className="h-12 flex-1 rounded-lg border border-[rgb(64_72_93_/_0.24)] bg-background px-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-[rgb(186_158_255_/_0.45)] focus:ring-2 focus:ring-[rgb(186_158_255_/_0.2)]"
                          />
                          <SecondaryButton type="button" onClick={handleImageUrlApply} className="justify-center" disabled={!isEditable}>
                            Use URL
                          </SecondaryButton>
                        </div>
                        <p className="mt-3 text-xs text-on-surface-variant">
                          Gunakan opsi ini jika thumbnail sudah di-host di CDN, storage bucket, atau link gambar publik lain.
                        </p>
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                      <div className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-background">
                        {thumbnailPreviewUrl ? (
                          <img src={thumbnailPreviewUrl} alt="Stream thumbnail preview" className="aspect-video h-full w-full object-cover" />
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-[linear-gradient(135deg,rgba(15,25,48,0.9),rgba(20,31,56,0.85))]">
                            <div className="text-center">
                              <MaterialIcon name="image" className="mx-auto text-3xl text-on-surface-variant" />
                              <p className="mt-2 text-sm text-on-surface-variant">Thumbnail preview</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-surface-container-high p-4">
                        <p className="text-sm font-semibold text-on-surface">Cover Source</p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          {thumbnailMode === "upload"
                            ? "Uploaded file akan disimpan sebagai cover stream saat kamu menekan Save Draft atau Go Live."
                            : "Image URL akan dipakai apa adanya sebagai thumbnail room."}
                        </p>
                        <div className="mt-4 text-xs text-on-surface-variant">
                          <p>Recommended ratio: 16:9</p>
                          <p className="mt-1">Best size: 1280 x 720</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FieldBlock>
              </div>
            </div>
          </ContentCard>

          <ContentCard className="p-7 md:p-8">
            <div className="mb-6 flex items-center gap-2">
              <MaterialIcon name="admin_panel_settings" className="text-primary" />
              <h2 className="font-display text-xl font-bold tracking-tight text-on-surface">Stream Settings</h2>
            </div>

            <div className="grid gap-4">
              <ToggleCard
                title="Enable Chat"
                description="Penonton bisa mengirim chat saat room sudah published atau live."
                checked={form.chatEnabled}
                disabled={!isEditable}
                onChange={(checked) => setForm((current) => ({ ...current, chatEnabled: checked }))}
              />
              <ToggleCard
                title="Enable Gifts"
                description="Aktifkan dukungan gift selama siaran untuk monetisasi host."
                checked={form.giftEnabled}
                disabled={!isEditable}
                onChange={(checked) => setForm((current) => ({ ...current, giftEnabled: checked }))}
              />
            </div>
          </ContentCard>
        </div>

        <div className="space-y-8">
          <ContentCard className="bg-surface-container-high p-6">
            <div className="flex items-center gap-2 border-b border-[rgb(64_72_93_/_0.16)] pb-4">
              <MaterialIcon name="router" className="text-primary" />
              <h2 className="font-display text-lg font-bold tracking-tight text-on-surface">OBS Streaming Setup</h2>
            </div>

            {isLoading ? (
              <div className="space-y-4 pt-5">
                <div className="h-14 rounded-xl bg-background/70" />
                <div className="h-14 rounded-xl bg-background/70" />
                <div className="h-28 rounded-xl bg-background/70" />
              </div>
            ) : broadcastConfig ? (
              <div className="space-y-5 pt-5">
                <ReadonlyField
                  label="RTMP Server URL"
                  value={broadcastConfig.ingestUrl}
                  actionLabel={copyState === "ingest" ? "Copied" : "Copy"}
                  onAction={() => handleCopy(broadcastConfig.ingestUrl, "ingest")}
                />
                <ReadonlyField
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
                      aria-label={isStreamKeyVisible ? "Hide stream key" : "Show stream key"}
                    >
                      <MaterialIcon name={isStreamKeyVisible ? "visibility_off" : "visibility"} className="text-[18px]" />
                    </button>
                  }
                />
                <ReadonlyField
                  label="Playback URL"
                  value={broadcastConfig.playbackUrl}
                  actionLabel={copyState === "playback" ? "Copied" : "Copy"}
                  onAction={() => handleCopy(broadcastConfig.playbackUrl, "playback")}
                />

                <div className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-background/80 p-4">
                  <p className="text-sm font-semibold text-on-surface">OBS Quick Setup</p>
                  <ol className="mt-3 space-y-2 text-sm text-on-surface-variant">
                    <li>
                      1. Buka OBS dan masuk ke <code>Settings &gt; Stream</code>.
                    </li>
                    <li>
                      2. Set <code>Service</code> ke <code>Custom...</code>.
                    </li>
                    <li>
                      3. Paste <code>RTMP Server URL</code> dan <code>Stream Key</code> dari panel ini.
                    </li>
                    <li>4. Pastikan status room sudah <code>PUBLISHED</code> atau <code>LIVE</code> sebelum menekan Start Streaming di OBS.</li>
                  </ol>
                </div>
                {broadcastConfig.roomStatus === "DRAFT" ? (
                  <div className="rounded-xl border border-[rgb(255_110_132_/_0.24)] bg-[rgb(167_1_56_/_0.14)] px-4 py-3 text-sm text-on-error-container">
                    OBS belum bisa memakai kredensial ini selama room masih <code>DRAFT</code>. Tekan <code>Publish Room</code> dulu.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="pt-5 text-sm text-on-surface-variant">
                Setup OBS akan muncul setelah draft room berhasil dibuat.
              </div>
            )}
          </ContentCard>

          <ContentCard className="p-6">
            <SectionHeader
              title="Publishing Controls"
              description="Save Draft hanya menyimpan metadata. Publish Room mengubah backend room state menjadi PUBLISHED agar OBS bisa connect."
            />
            <div className="mt-5 grid gap-3">
              <SecondaryButton type="button" onClick={handleSaveDraft} disabled={isLoading || isSaving || !isEditable}>
                {isSaving ? "Saving..." : "Save Draft"}
              </SecondaryButton>
              <PrimaryButton type="button" onClick={handlePublishRoom} disabled={isLoading || isPublishing || !isRoomReady}>
                {isPublishing ? "Publishing..." : primaryActionLabel}
              </PrimaryButton>
            </div>
            {room?.status === "DRAFT" ? (
              <div className="mt-4 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-background/70 px-4 py-3 text-sm text-on-surface-variant">
                <p>1. Isi title, description, category, dan thumbnail.</p>
                <p className="mt-1">
                  2. Tekan <code>Publish Room</code>.
                </p>
                <p className="mt-1">
                  3. Setelah status menjadi <code>PUBLISHED</code>, baru mulai streaming dari OBS.
                </p>
              </div>
            ) : null}
            <div className="mt-5 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container p-4 text-sm text-on-surface-variant">
              <p className="font-semibold text-on-surface">Current Room</p>
              <div className="mt-3 grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <span>Room ID</span>
                  <span className="font-mono text-xs text-on-surface">{room?.id ?? "--"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Host</span>
                  <span className="text-on-surface">{user?.name ?? "--"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>State</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusPillClassName}`}>
                    {broadcastConfig?.roomStatus ?? room?.status ?? "--"}
                  </span>
                </div>
              </div>
            </div>
          </ContentCard>

          <ContentCard className="p-6">
            <SectionHeader title="Hardware Check" description="Frontend check ringan untuk membantu sebelum OBS mulai siaran." />
            <div className="mt-5 space-y-3">
              <HardwareRow icon="desktop_windows" title="Platform" meta="Windows / Desktop OBS recommended" healthy />
              <HardwareRow icon="wifi" title="Network" meta="Gunakan koneksi stabil sebelum publish" warning={broadcastConfig?.roomStatus === "PUBLISHED"} />
              <HardwareRow icon="photo_camera" title="Thumbnail" meta={thumbnailPreviewUrl ? "Ready for publishing" : "Please add a cover image"} healthy={Boolean(thumbnailPreviewUrl)} warning={!thumbnailPreviewUrl} />
            </div>
          </ContentCard>
        </div>
      </section>
    </PageContainer>
  );

  function buildRoomPayload(currentForm: typeof form) {
    const normalizedCover =
      thumbnailMode === "url" ? currentForm.imageUrlInput.trim() || null : currentForm.coverImageUrl.trim() || null;

    return {
      title: currentForm.title.trim() || "Untitled Stream",
      description: currentForm.description.trim() || null,
      category: currentForm.category.trim() || null,
      coverImageUrl: normalizedCover,
      chatEnabled: currentForm.chatEnabled,
      giftEnabled: currentForm.giftEnabled,
    };
  }
}

function FieldBlock({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-on-surface-variant">
        {label} {required ? <span className="text-error">*</span> : null}
      </div>
      {children}
    </label>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-background/80 p-4">
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-primary" : "bg-surface-bright"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function ReadonlyField({
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

function HardwareRow({
  icon,
  title,
  meta,
  healthy = false,
  warning = false,
}: {
  icon: string;
  title: string;
  meta: string;
  healthy?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3 ${
        warning
          ? "border-[rgb(255_110_132_/_0.22)] bg-[rgb(167_1_56_/_0.12)]"
          : "border-[rgb(64_72_93_/_0.18)] bg-surface-container-low"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            healthy ? "bg-[rgb(105_246_184_/_0.12)] text-tertiary" : "bg-[rgb(255_110_132_/_0.12)] text-error"
          }`}
        >
          <MaterialIcon name={icon} className="text-[18px]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-on-surface">{title}</p>
          <p className={`text-xs ${warning ? "text-error" : "text-on-surface-variant"}`}>{meta}</p>
        </div>
      </div>
      <MaterialIcon name={healthy ? "check_circle" : "warning"} filled={healthy} className={healthy ? "text-tertiary" : "text-error"} />
    </div>
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
    default:
      return "bg-[rgb(186_158_255_/_0.08)] text-primary";
  }
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "HOST_NOT_APPROVED") {
      return "Akun ini belum approved sebagai host. Gunakan akun host yang sudah approved atau selesaikan approval host terlebih dahulu.";
    }

    if (error.code === "ROOM_ALREADY_LIVE") {
      return "Masih ada room host lain yang berstatus LIVE. Halaman ini sekarang akan memprioritaskan room aktif itu. Jika itu room lama, akhiri dulu lewat tombol End Room.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan tak terduga.";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Gagal membaca file thumbnail."));
    reader.readAsDataURL(file);
  });
}

function maskSecret(value: string) {
  if (value.length <= 8) {
    return "•".repeat(value.length);
  }

  return `${value.slice(0, 4)}${"•".repeat(Math.max(6, value.length - 8))}${value.slice(-4)}`;
}

async function resolveActiveRoom(token: string, signal?: AbortSignal) {
  const existingRooms = await apiRequest<{ rooms: RoomView[] }>(`/rooms/my?limit=20`, {
    token,
    signal,
  });

  const activeRoom =
    existingRooms.rooms.find((item) => item.status === "LIVE") ??
    existingRooms.rooms.find((item) => item.status === "PUBLISHED") ??
    existingRooms.rooms.find((item) => item.status === "DRAFT") ??
    null;

  if (activeRoom) {
    return activeRoom;
  }

  const created = await apiRequest<{ room: RoomView }>("/rooms", {
    method: "POST",
    token,
    signal,
    body: {
      title: defaultFormState.title,
      description: defaultFormState.description,
      category: defaultFormState.category,
      coverImageUrl: null,
    },
  });

  return created.room;
}
