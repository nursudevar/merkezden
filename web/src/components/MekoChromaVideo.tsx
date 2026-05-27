"use client";

import { useEffect, useRef } from "react";

type MekoChromaVideoProps = {
  src: string;
  className?: string;
  ariaLabel?: string;
  threshold?: number;
};

export default function MekoChromaVideo({
  src,
  className,
  ariaLabel,
  threshold = 10,
}: MekoChromaVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
    if (!offscreenCtx) return;

    // Video elementinin görünmez ama çalışır olmasını garanti et.
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    const drawFrame = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          const w = video.videoWidth;
          const h = video.videoHeight;

          // Boyutlar metadata sonrası değişirse senkron tut.
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          if (offscreenCanvas.width !== w || offscreenCanvas.height !== h) {
            offscreenCanvas.width = w;
            offscreenCanvas.height = h;
          }

          // Offscreen işle: temizle -> çiz -> oku -> alpha uygula
          offscreenCtx.clearRect(0, 0, w, h);
          offscreenCtx.drawImage(video, 0, 0, w, h);
          const frame = offscreenCtx.getImageData(0, 0, w, h);
          const data = frame.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r <= threshold && g <= threshold && b <= threshold) {
              data[i + 3] = 0;
            }
          }

          // Visible canvas: her frame temizle -> yaz
          ctx.clearRect(0, 0, w, h);
          ctx.putImageData(frame, 0, 0);
        } catch {
          // Canvas read hatası olursa sadece ham frame gösterilir.
          // Bu durumda ghosting oluşmaması için visible canvas yine temizlenir.
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch {
            // ignore
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(drawFrame);
    };

    const onLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        offscreenCanvas.width = video.videoWidth;
        offscreenCanvas.height = video.videoHeight;
      }

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Bazı tarayıcılar autoplay'i geciktirebilir.
        });
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    onLoadedMetadata();
    rafRef.current = window.requestAnimationFrame(drawFrame);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      video.pause();
    };
  }, [src, threshold]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        className={className}
        role="img"
        aria-label={ariaLabel || "Meko animation"}
      />
    </>
  );
}

