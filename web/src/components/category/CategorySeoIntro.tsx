"use client";

import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  getCategorySeoBySlug,
  type CategorySeoTextPart,
} from "@/lib/seo/categorySeoContent";

const TOGGLE_MORE_LABEL = "Daha Fazla Göster";
const TOGGLE_LESS_LABEL = "Daha Az Göster";
const TOGGLE_SUFFIX = ` ${TOGGLE_MORE_LABEL}`;
const LINE_COUNT = 3;

function renderBodyParts(parts: CategorySeoTextPart[]) {
  return parts.map((part, index) => {
    if (part.type === "strong") {
      return <strong key={index}>{part.value}</strong>;
    }
    const segments = part.value.split("\n\n");
    return (
      <Fragment key={index}>
        {segments.map((segment, segmentIndex) => (
          <Fragment key={`${index}-${segmentIndex}`}>
            {segmentIndex > 0 ? (
              <>
                <br />
                <br />
              </>
            ) : null}
            {segment}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

function flattenPlainText(parts: CategorySeoTextPart[]): string {
  return parts
    .map((part) => part.value)
    .join("")
    .replace(/\n\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (maxLen <= 0) return "";
  if (text.length <= maxLen) return text;
  let cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxLen * 0.55)) {
    cut = cut.slice(0, lastSpace);
  }
  return cut.trimEnd();
}

function measureFits(el: HTMLElement, text: string, maxHeight: number): boolean {
  el.textContent = text;
  return el.getBoundingClientRect().height <= maxHeight + 0.5;
}

function fitTeaserToLines(
  plain: string,
  measureEl: HTMLElement,
  maxHeight: number,
): string {
  if (measureFits(measureEl, plain + TOGGLE_SUFFIX, maxHeight)) {
    return plain;
  }

  let lo = 0;
  let hi = plain.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = truncateAtWordBoundary(plain, mid);
    if (!candidate) {
      hi = mid - 1;
      continue;
    }
    if (measureFits(measureEl, candidate + TOGGLE_SUFFIX, maxHeight)) {
      best = candidate.length;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return truncateAtWordBoundary(plain, best);
}

/**
 * Breadcrumb altında kategori H1 + uzun SEO açıklaması.
 * Kapalı: teaser + inline "Daha Fazla Göster" birlikte tam 3 satır.
 * Tam SEO gövdesi her zaman DOM'da (SSR HTML'de) kalır.
 */
export default function CategorySeoIntro() {
  const pathname = usePathname();
  const slug = useMemo(() => {
    const segments = String(pathname ?? "")
      .split("/")
      .filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }, [pathname]);

  const seo = getCategorySeoBySlug(slug);
  const plainText = useMemo(
    () => (seo ? flattenPlainText(seo.body) : ""),
    [seo],
  );

  const [expanded, setExpanded] = useState(false);
  const [teaserText, setTeaserText] = useState<string | null>(null);
  const [needsCollapse, setNeedsCollapse] = useState(true);

  const hostRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const recomputeTeaser = useCallback(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure || !plainText) return;

    const width = host.clientWidth;
    if (width <= 0) return;

    const styles = window.getComputedStyle(measure);
    const fontSize = Number.parseFloat(styles.fontSize) || 14;
    const lineHeightRaw = styles.lineHeight;
    const lineHeight =
      lineHeightRaw === "normal"
        ? fontSize * 1.65
        : Number.parseFloat(lineHeightRaw) || fontSize * 1.65;
    const maxHeight = lineHeight * LINE_COUNT;

    measure.style.width = `${width}px`;

    const overflowsAlone = !measureFits(measure, plainText, maxHeight);
    setNeedsCollapse(overflowsAlone);

    if (!overflowsAlone) {
      setTeaserText(null);
      return;
    }

    setTeaserText(fitTeaserToLines(plainText, measure, maxHeight));
  }, [plainText]);

  useLayoutEffect(() => {
    if (!seo || expanded) return;

    recomputeTeaser();

    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      recomputeTeaser();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [seo, expanded, recomputeTeaser]);

  if (!seo) return null;

  const showTeaser = !expanded && needsCollapse && teaserText != null;
  const showClampFallback = !expanded && needsCollapse && teaserText == null;

  return (
    <section className="category-seo-intro" aria-labelledby="category-seo-intro-heading">
      <h1 id="category-seo-intro-heading" className="category-seo-intro-title">
        {seo.h1}
      </h1>

      <div
        ref={hostRef}
        className={`category-seo-intro-body${
          expanded ? " category-seo-intro-body--expanded" : ""
        }`}
      >
        <p
          className={[
            "category-seo-intro-text",
            showTeaser ? "category-seo-intro-text--parked" : "",
            showClampFallback ? "category-seo-intro-text--clamp" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {renderBodyParts(seo.body)}
          {expanded ? (
            <>
              {" "}
              <button
                type="button"
                className="category-seo-intro-toggle"
                aria-expanded="true"
                onClick={() => setExpanded(false)}
              >
                {TOGGLE_LESS_LABEL}
              </button>
            </>
          ) : null}
        </p>

        {showTeaser ? (
          <p className="category-seo-intro-teaser">
            {teaserText}{" "}
            <button
              type="button"
              className="category-seo-intro-toggle"
              aria-expanded="false"
              onClick={() => setExpanded(true)}
            >
              {TOGGLE_MORE_LABEL}
            </button>
          </p>
        ) : null}
      </div>

      <div
        ref={measureRef}
        className="category-seo-intro-measure category-seo-intro-teaser"
        aria-hidden="true"
      />
    </section>
  );
}
