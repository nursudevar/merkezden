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

/** CSS line-clamp / ellipsis ile kesilen metin alanları — global tooltip hedefleri. */
export const CLAMPED_TEXT_TOOLTIP_SELECTORS = [
  ".featured-institutions-list-card-title",
  ".featured-institution-name",
  ".featured-institution-subcategory",
  ".category-results-card-title",
  ".category-results-card-description",
  ".category-results-card-location span",
  ".category-results-card-subcategory-badge",
  ".category-filter-checkbox-label",
  ".category-option",
  ".blog-card-title-new",
  ".blog-card-excerpt",
  ".search-result-name",
  ".search-result-description",
  ".service-card-title",
  ".service-card-categories",
  ".purple-featured-card-title",
  ".announcement-featured-title",
  ".announcement-featured-desc",
  ".announcement-small-title",
  ".announcement-small-desc",
  ".home-main-category-card-title",
  ".favorite-card-title",
  ".favorite-card-description",
  ".featured-post-excerpt",
  ".blog-list-item-excerpt",
  ".panel-overview-announcements-item-desc",
  ".panel-announcements-desc-clamp",
  ".panel-institutions-feature-select-label",
  ".panel-institutions-feature-select-option",
  ".okullar-table-cell-truncate",
  ".okullar-category-badge",
  ".okullar-category-dropdown-label",
  ".header-hamburger-welcome-name",
  ".institution-announcement-desc",
  ".nasil-calisir-feature-card-description",
  ".signup-date-picker-trigger-text",
  "[data-tooltip-text]",
].join(", ");

export const CLAMPED_TEXT_TOOLTIP_IGNORE_SELECTORS =
  ".clamped-text-tooltip-wrap, .clamped-text-tooltip, .leaflet-tooltip, .leaflet-popup";
