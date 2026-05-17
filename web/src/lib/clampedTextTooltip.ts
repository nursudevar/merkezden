export type ClampedTooltipCoords = {
  top: number;
  left: number;
  maxWidth: number;
};

export const CLAMPED_TOOLTIP_VIEWPORT_PADDING = 12;
export const CLAMPED_TOOLTIP_GAP = 6;
export const CLAMPED_TOOLTIP_MAX_WIDTH = 300;
export const CLAMPED_TOOLTIP_Z_INDEX = 10050;

export function isElementTextTruncated(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

export function getClampedTooltipText(el: HTMLElement): string {
  const dataText = el.getAttribute("data-tooltip-text")?.trim();
  if (dataText) return dataText;
  return (el.textContent ?? "").trim();
}

export function shouldShowClampedTooltip(el: HTMLElement): boolean {
  const fullText = getClampedTooltipText(el);
  if (!fullText) return false;

  if (el.hasAttribute("data-tooltip-text")) {
    const visible = (el.textContent ?? "").trim();
    return visible !== fullText || isElementTextTruncated(el);
  }

  return isElementTextTruncated(el);
}

export function computeClampedTooltipCoords(
  anchor: HTMLElement,
  tooltip: HTMLElement,
): ClampedTooltipCoords {
  const rect = anchor.getBoundingClientRect();
  const maxWidth = Math.min(
    CLAMPED_TOOLTIP_MAX_WIDTH,
    window.innerWidth - CLAMPED_TOOLTIP_VIEWPORT_PADDING * 2,
  );
  const tooltipHeight = tooltip.offsetHeight;
  const tooltipWidth = Math.min(tooltip.offsetWidth, maxWidth);

  let top = rect.bottom + CLAMPED_TOOLTIP_GAP;
  if (top + tooltipHeight > window.innerHeight - CLAMPED_TOOLTIP_VIEWPORT_PADDING) {
    top = rect.top - CLAMPED_TOOLTIP_GAP - tooltipHeight;
  }
  top = Math.max(
    CLAMPED_TOOLTIP_VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - CLAMPED_TOOLTIP_VIEWPORT_PADDING - tooltipHeight),
  );

  let left = rect.left + rect.width / 2;
  const halfWidth = tooltipWidth / 2;
  const minLeft = CLAMPED_TOOLTIP_VIEWPORT_PADDING + halfWidth;
  const maxLeft = window.innerWidth - CLAMPED_TOOLTIP_VIEWPORT_PADDING - halfWidth;
  left = Math.max(minLeft, Math.min(maxLeft, left));

  return { top, left, maxWidth };
}
