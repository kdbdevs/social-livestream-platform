import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "./layout.js";

type HlsInstance = {
  attachMedia: (media: HTMLVideoElement) => void;
  loadSource: (src: string) => void;
  destroy: () => void;
};

type HlsConstructor = {
  new (): HlsInstance;
  isSupported: () => boolean;
};

declare global {
  interface Window {
    Hls?: HlsConstructor;
    __neonpulseHlsPromise?: Promise<HlsConstructor | null>;
  }
}

export function MediaPlayer({
  src,
  poster,
  title,
  autoPlay = false,
  muted = false,
}: {
  src: string | null;
  poster?: string | null;
  title: string;
  autoPlay?: boolean;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      return;
    }

    let hls: HlsInstance | null = null;
    let cancelled = false;

    setError("");

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    void loadHlsLibrary().then((Hls) => {
      if (cancelled) {
        return;
      }

      if (!Hls || !Hls.isSupported()) {
        setError("Browser ini belum bisa memutar HLS langsung.");
        return;
      }

      hls = new Hls();
      hls.attachMedia(video);
      hls.loadSource(src);
    });

    return () => {
      cancelled = true;

      if (hls) {
        hls.destroy();
      }

      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(64_72_93_/_0.24)] bg-background">
      <div className="relative aspect-video bg-surface-container-high">
        {src ? (
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay={autoPlay}
            muted={muted}
            poster={poster ?? undefined}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MaterialIcon name="live_tv" className="mx-auto text-4xl text-on-surface-variant" />
              <p className="mt-3 text-sm text-on-surface-variant">Live playback belum tersedia</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-[rgb(255_110_132_/_0.14)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-error">
          <span className="h-2 w-2 rounded-full bg-error" />
          Live
        </div>
      </div>

      <div className="border-t border-[rgb(64_72_93_/_0.16)] px-4 py-3">
        <p className="truncate text-sm font-semibold text-on-surface">{title}</p>
        {error ? <p className="mt-1 text-xs text-error">{error}</p> : <p className="mt-1 text-xs text-on-surface-variant">Streaming source from backend playback URL</p>}
      </div>
    </div>
  );
}

export function loadHlsLibrary() {
  if (typeof window === "undefined") {
    return Promise.resolve<HlsConstructor | null>(null);
  }

  if (window.Hls) {
    return Promise.resolve(window.Hls);
  }

  if (window.__neonpulseHlsPromise) {
    return window.__neonpulseHlsPromise;
  }

  window.__neonpulseHlsPromise = new Promise<HlsConstructor | null>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-neonpulse-hls="true"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Hls ?? null), { once: true });
      existingScript.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    script.async = true;
    script.dataset.neonpulseHls = "true";
    script.onload = () => resolve(window.Hls ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return window.__neonpulseHlsPromise;
}
