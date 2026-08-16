"use client";

import { useEffect, useState } from "react";
import {
  fetchIlcelerByIlId,
  fetchIller,
  fetchMahallelerByIlceId,
  findLocationIdByAd,
  findLocationSlugById,
  HOME_DEFAULT_CITY_AD,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";

export type PublicBreadcrumbItem = {
  label: string;
  href?: string;
};

export type LocationBreadcrumbLevel = {
  ad: string;
  slug: string;
};

export type LocationBreadcrumbTrail = {
  il: LocationBreadcrumbLevel | null;
  ilce: LocationBreadcrumbLevel | null;
  mahalle: LocationBreadcrumbLevel | null;
  defaultIlSlug: string;
};

const IL_SLUG_PARAM = "il";
const ILCE_SLUG_PARAM = "ilce";
const MAHALLE_SLUG_PARAM = "mahalle";

/** Mevcut kategori route etiketleri — breadcrumb için ikinci bir tablo yok. */
export const ROUTE_CATEGORY_BREADCRUMB_LABELS: Record<string, string> = {
  okul: "OKUL",
  "kurs-ve-sinava-hazirlik": "KURS & SINAVA HAZIRLIK",
  "surucu-kursu": "SÜRÜCÜ KURSU",
  spor: "SPOR",
  sanat: "SANAT",
  "yabanci-dil": "YABANCI DİL",
  "kisisel-gelisim": "KİŞİSEL GELİŞİM",
  "mesleki-egitim": "MESLEKİ EĞİTİM",
  "ozel-egitim": "ÖZEL EĞİTİM",
  "patili-dostlar": "PATİLİ DOSTLAR",
  egitmenler: "EĞİTMENLER",
  duyurular: "DUYURULAR",
  "haritada-ara": "HARİTADA ARA",
};

const EMPTY_TRAIL: LocationBreadcrumbTrail = {
  il: null,
  ilce: null,
  mahalle: null,
  defaultIlSlug: "",
};

export function toBreadcrumbLabel(value: string): string {
  return String(value ?? "").trim().toLocaleUpperCase("tr-TR");
}

export function getRouteCategoryBreadcrumbLabel(pathnameOrSlug: string): string {
  const normalized = String(pathnameOrSlug ?? "").trim();
  const slug = normalized.split("/").filter(Boolean).pop() || "";
  if (ROUTE_CATEGORY_BREADCRUMB_LABELS[slug]) {
    return ROUTE_CATEGORY_BREADCRUMB_LABELS[slug];
  }
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .toLocaleUpperCase("tr-TR");
}

function optionToLevel(row: TurkiyeLocationOption | undefined): LocationBreadcrumbLevel | null {
  if (!row) return null;
  const ad = String(row.ad ?? "").trim();
  if (!ad) return null;
  return { ad, slug: String(row.slug ?? "").trim().toLowerCase() };
}

function findOptionById(
  rows: TurkiyeLocationOption[],
  id: number | null,
): TurkiyeLocationOption | undefined {
  if (id == null) return undefined;
  return rows.find((row) => row.id === id);
}

export function buildLocationListingHref(
  pathname: string,
  trail: {
    ilSlug?: string;
    ilceSlug?: string;
    mahalleSlug?: string;
  },
  defaultIlSlug = "",
): string {
  const basePath = String(pathname ?? "").trim() || "/";
  const ilSlug = String(trail.ilSlug ?? "").trim().toLowerCase();
  const ilceSlug = String(trail.ilceSlug ?? "").trim().toLowerCase();
  const mahalleSlug = String(trail.mahalleSlug ?? "").trim().toLowerCase();
  const normalizedDefault = String(defaultIlSlug ?? "").trim().toLowerCase();
  const isDefaultCityOnly =
    (!ilSlug || (normalizedDefault && ilSlug === normalizedDefault)) &&
    !ilceSlug &&
    !mahalleSlug;

  if (isDefaultCityOnly) return basePath;

  const params = new URLSearchParams();
  if (ilSlug) params.set(IL_SLUG_PARAM, ilSlug);
  if (ilceSlug) params.set(ILCE_SLUG_PARAM, ilceSlug);
  if (mahalleSlug) params.set(MAHALLE_SLUG_PARAM, mahalleSlug);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function defaultCityTrail(defaultIlSlug = ""): LocationBreadcrumbTrail {
  return {
    il: { ad: HOME_DEFAULT_CITY_AD, slug: defaultIlSlug },
    ilce: null,
    mahalle: null,
    defaultIlSlug,
  };
}

export async function resolveLocationBreadcrumbTrail(
  location: { ilId?: unknown; ilceId?: unknown; mahalleId?: unknown },
  options?: { applyDefaultCity?: boolean },
): Promise<LocationBreadcrumbTrail> {
  const applyDefaultCity = options?.applyDefaultCity === true;
  const parsedIlId = parseLocationId(location.ilId);
  const parsedIlceId = parseLocationId(location.ilceId);
  const parsedMahalleId = parseLocationId(location.mahalleId);

  const iller = await fetchIller();
  const defaultIlId = findLocationIdByAd(iller, HOME_DEFAULT_CITY_AD);
  const defaultIlSlug = findLocationSlugById(iller, defaultIlId);
  const resolvedIlId = parsedIlId ?? (applyDefaultCity ? parseLocationId(defaultIlId) : null);

  if (resolvedIlId == null) {
    return applyDefaultCity ? defaultCityTrail(defaultIlSlug) : { ...EMPTY_TRAIL, defaultIlSlug };
  }

  const il = optionToLevel(findOptionById(iller, resolvedIlId));
  if (!il) {
    return applyDefaultCity ? defaultCityTrail(defaultIlSlug) : { ...EMPTY_TRAIL, defaultIlSlug };
  }

  let ilce: LocationBreadcrumbLevel | null = null;
  let mahalle: LocationBreadcrumbLevel | null = null;

  if (parsedIlceId != null) {
    const ilceler = await fetchIlcelerByIlId(resolvedIlId);
    ilce = optionToLevel(findOptionById(ilceler, parsedIlceId));
    if (ilce && parsedMahalleId != null) {
      const mahalleler = await fetchMahallelerByIlceId(parsedIlceId);
      mahalle = optionToLevel(findOptionById(mahalleler, parsedMahalleId));
    }
  }

  return { il, ilce, mahalle, defaultIlSlug };
}

export function useLocationBreadcrumbTrail(
  location: { ilId?: unknown; ilceId?: unknown; mahalleId?: unknown },
  options?: { applyDefaultCity?: boolean },
): LocationBreadcrumbTrail {
  const applyDefaultCity = options?.applyDefaultCity === true;
  const ilId = parseLocationId(location.ilId);
  const ilceId = parseLocationId(location.ilceId);
  const mahalleId = parseLocationId(location.mahalleId);
  const [trail, setTrail] = useState<LocationBreadcrumbTrail>(() =>
    applyDefaultCity && ilId == null ? defaultCityTrail() : EMPTY_TRAIL,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await resolveLocationBreadcrumbTrail(
          { ilId, ilceId, mahalleId },
          { applyDefaultCity },
        );
        if (!cancelled) setTrail(next);
      } catch {
        if (!cancelled) {
          setTrail(
            applyDefaultCity && ilId == null ? defaultCityTrail() : EMPTY_TRAIL,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyDefaultCity, ilId, ilceId, mahalleId]);

  return trail;
}

export function assemblePublicBreadcrumbItems(options: {
  categoryLabel?: string;
  categoryHref?: string;
  extraItems?: PublicBreadcrumbItem[];
  trail: LocationBreadcrumbTrail;
  listingPathname?: string;
  currentLabel?: string;
}): PublicBreadcrumbItem[] {
  const items: PublicBreadcrumbItem[] = [{ label: "ANA SAYFA", href: "/" }];
  const listingPathname = String(options.listingPathname ?? "").trim();
  const defaultIlSlug = options.trail.defaultIlSlug;
  const categoryLabel = toBreadcrumbLabel(options.categoryLabel ?? "");
  const extraItems = (options.extraItems ?? [])
    .map((item) => ({
      label: toBreadcrumbLabel(item.label),
      href: item.href,
    }))
    .filter((item) => item.label.length > 0);
  const currentLabel = String(options.currentLabel ?? "").trim();

  if (categoryLabel) {
    items.push({
      label: categoryLabel,
      href: options.categoryHref || listingPathname || undefined,
    });
  }

  for (const extra of extraItems) {
    items.push(extra);
  }

  if (options.trail.il) {
    items.push({
      label: toBreadcrumbLabel(options.trail.il.ad),
      href: listingPathname
        ? buildLocationListingHref(
            listingPathname,
            { ilSlug: options.trail.il.slug },
            defaultIlSlug,
          )
        : undefined,
    });
  }

  if (options.trail.il && options.trail.ilce) {
    items.push({
      label: toBreadcrumbLabel(options.trail.ilce.ad),
      href: listingPathname
        ? buildLocationListingHref(
            listingPathname,
            {
              ilSlug: options.trail.il.slug,
              ilceSlug: options.trail.ilce.slug,
            },
            defaultIlSlug,
          )
        : undefined,
    });
  }

  if (options.trail.il && options.trail.ilce && options.trail.mahalle) {
    items.push({
      label: toBreadcrumbLabel(options.trail.mahalle.ad),
      href: listingPathname
        ? buildLocationListingHref(
            listingPathname,
            {
              ilSlug: options.trail.il.slug,
              ilceSlug: options.trail.ilce.slug,
              mahalleSlug: options.trail.mahalle.slug,
            },
            defaultIlSlug,
          )
        : undefined,
    });
  }

  if (currentLabel) {
    items.push({ label: currentLabel });
  }

  const lastIndex = items.length - 1;
  return items.map((item, index) => {
    if (index === 0) return item;
    if (index === lastIndex) return { label: item.label };
    return item;
  });
}
