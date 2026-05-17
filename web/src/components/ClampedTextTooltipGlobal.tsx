"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  CLAMPED_TOOLTIP_MAX_WIDTH,
  CLAMPED_TOOLTIP_Z_INDEX,
  computeClampedTooltipCoords,
  getClampedTooltipText,
  shouldShowClampedTooltip,
  type ClampedTooltipCoords,
} from "@/lib/clampedTextTooltip";
import {
  CLAMPED_TEXT_TOOLTIP_IGNORE_SELECTORS,
  CLAMPED_TEXT_TOOLTIP_SELECTORS,
} from "@/lib/clampedTextTooltipSelectors";

type ActiveTooltip = {
  text: string;
  anchor: HTMLElement;
};

export function ClampedTextTooltipGlobal() {
  const anchorRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [coords, setCoords] = useState<ClampedTooltipCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hideTooltip = () => {
    anchorRef.current = null;
    setActive(null);
    setCoords(null);
  };

  const updatePosition = () => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    setCoords(computeClampedTooltipCoords(anchor, tooltip));
  };

  useEffect(() => {
    const resolveTarget = (eventTarget: EventTarget | null): HTMLElement | null => {
      if (!(eventTarget instanceof HTMLElement)) return null;
      const match = eventTarget.closest(CLAMPED_TEXT_TOOLTIP_SELECTORS);
      if (!(match instanceof HTMLElement)) return null;
      if (match.closest(CLAMPED_TEXT_TOOLTIP_IGNORE_SELECTORS)) return null;
      return match;
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = resolveTarget(event.target);
      if (!target) {
        if (anchorRef.current) hideTooltip();
        return;
      }
      if (anchorRef.current === target) return;
      if (!shouldShowClampedTooltip(target)) {
        if (anchorRef.current) hideTooltip();
        return;
      }

      anchorRef.current = target;
      setActive({ text: getClampedTooltipText(target), anchor: target });
    };

    const handlePointerOut = (event: PointerEvent) => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const related = event.relatedTarget;
      if (related instanceof Node && anchor.contains(related)) return;
      hideTooltip();
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);

  useLayoutEffect(() => {
    if (!active) {
      setCoords(null);
      return;
    }

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active]);

  if (!mounted || !active) return null;

  const tooltipStyle: CSSProperties = coords
    ? {
        position: "fixed",
        top: coords.top,
        left: coords.left,
        transform: "translateX(-50%)",
        maxWidth: coords.maxWidth,
        zIndex: CLAMPED_TOOLTIP_Z_INDEX,
      }
    : {
        position: "fixed",
        top: -9999,
        left: -9999,
        visibility: "hidden",
        maxWidth: CLAMPED_TOOLTIP_MAX_WIDTH,
        zIndex: CLAMPED_TOOLTIP_Z_INDEX,
      };

  return createPortal(
    <span
      ref={tooltipRef}
      className="clamped-text-tooltip clamped-text-tooltip--portal"
      role="tooltip"
      style={tooltipStyle}
    >
      {active.text}
    </span>,
    document.body,
  );
}
