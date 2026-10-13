"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import "@/styles/components/gallery-media-viewer.scss";

export type GalleryViewerMedia = {
  id: string;
  url: string;
  mediaType: "photo" | "video";
  alt: string;
};

type GalleryMediaViewerProps = {
  items: GalleryViewerMedia[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
};

export function useGalleryModalEffects(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export default function GalleryMediaViewer({
  items,
  activeIndex,
  onIndexChange,
}: GalleryMediaViewerProps) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const item = items[activeIndex] ?? null;
  const showThumbs = items.length > 1;

  useEffect(() => {
    if (!item) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isEditableKeyTarget(event.target) || event.target instanceof HTMLVideoElement) return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      onIndexChange((activeIndex + delta + items.length) % items.length);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, item, items.length, onIndexChange]);

  useEffect(() => {
    if (!showThumbs) return;
    const strip = stripRef.current;
    const thumb = thumbRefs.current[activeIndex];
    if (!strip || !thumb) return;

    const stripRect = strip.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const delta = thumbRect.left - stripRect.left - (stripRect.width - thumbRect.width) / 2;
    strip.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeIndex, showThumbs]);

  if (!item) return null;

  const showPrevious = () => {
    onIndexChange((activeIndex - 1 + items.length) % items.length);
  };
  const showNext = () => {
    onIndexChange((activeIndex + 1) % items.length);
  };

  return (
    <div className="gallery-media-viewer">
      <div className="gallery-media-viewer-stage">
        {item.mediaType === "video" ? (
          <video
            key={item.id}
            className="gallery-media-viewer-video"
            src={item.url}
            controls
            autoPlay
            preload="metadata"
            playsInline
          />
        ) : (
          <Image
            key={item.id}
            src={item.url}
            alt={item.alt}
            fill
            className="gallery-media-viewer-image"
            sizes="(max-width: 768px) 100vw, 90vw"
            unoptimized
          />
        )}

        <button
          type="button"
          className="gallery-media-viewer-nav gallery-media-viewer-nav--prev"
          aria-label="Önceki medya"
          onClick={showPrevious}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="gallery-media-viewer-nav gallery-media-viewer-nav--next"
          aria-label="Sonraki medya"
          onClick={showNext}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {showThumbs ? (
        <div
          ref={stripRef}
          className="gallery-media-viewer-thumbs"
          role="tablist"
          aria-label="Galeri önizlemeleri"
        >
          {items.map((thumb, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={thumb.id}
                ref={(node) => {
                  thumbRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                className={`gallery-media-viewer-thumb${isActive ? " gallery-media-viewer-thumb--active" : ""}`}
                aria-label={`${index + 1}. medya`}
                aria-selected={isActive}
                onClick={() => onIndexChange(index)}
              >
                {thumb.mediaType === "video" ? (
                  <>
                    <video src={thumb.url} muted preload="metadata" playsInline tabIndex={-1} />
                    <span className="gallery-media-viewer-thumb-play" aria-hidden>
                      <Play size={14} />
                    </span>
                  </>
                ) : (
                  <Image
                    src={thumb.url}
                    alt=""
                    fill
                    className="gallery-media-viewer-thumb-image"
                    sizes="72px"
                    unoptimized
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
