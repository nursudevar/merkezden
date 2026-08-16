"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchIller,
  fetchIlcelerByIlId,
  fetchMahallelerByIlceId,
  findLocationIdByAd,
  findLocationIdBySlug,
  findLocationSlugById,
  HOME_DEFAULT_CITY_AD,
  parseLocationId,
} from "@/lib/turkiyeLocationsClient";

export type CategoryLocationFilterValue = {
  ilId: string;
  ilceId: string;
  mahalleId: string;
};

export const EMPTY_CATEGORY_LOCATION_FILTER: CategoryLocationFilterValue = {
  ilId: "",
  ilceId: "",
  mahalleId: "",
};

export const CATEGORY_ALL_ILCELER_VALUE = "__all__";
export const CATEGORY_ALL_MAHALLELER_VALUE = "__all_neighborhoods__";

const IL_SLUG_PARAM = "il";
const ILCE_SLUG_PARAM = "ilce";
const MAHALLE_SLUG_PARAM = "mahalle";
const LEGACY_IL_ID_PARAM = "il_id";
const LEGACY_ILCE_ID_PARAM = "ilce_id";
const LEGACY_MAHALLE_ID_PARAM = "mahalle_id";

function readSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function readSlugParam(params: URLSearchParams, key: string): string {
  return String(params.get(key) ?? "").trim();
}

function normalizeLocationValue(next: CategoryLocationFilterValue): CategoryLocationFilterValue {
  const normalized: CategoryLocationFilterValue = {
    ilId: parseLocationId(next.ilId) != null ? String(parseLocationId(next.ilId)) : "",
    ilceId: parseLocationId(next.ilceId) != null ? String(parseLocationId(next.ilceId)) : "",
    mahalleId: parseLocationId(next.mahalleId) != null ? String(parseLocationId(next.mahalleId)) : "",
  };
  if (!normalized.ilceId) normalized.mahalleId = "";
  return normalized;
}

function applyLocationSearch(nextSearch: string) {
  if (typeof window === "undefined") return;
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export async function resolveCategoryLocationFromSearch(
  search: string,
): Promise<CategoryLocationFilterValue> {
  const params = readSearchParams(search);
  const ilSlug = readSlugParam(params, IL_SLUG_PARAM);
  const ilceSlug = readSlugParam(params, ILCE_SLUG_PARAM);
  const mahalleSlug = readSlugParam(params, MAHALLE_SLUG_PARAM);
  const legacyIlId = parseLocationId(params.get(LEGACY_IL_ID_PARAM));
  const legacyIlceId = parseLocationId(params.get(LEGACY_ILCE_ID_PARAM));
  const legacyMahalleId = parseLocationId(params.get(LEGACY_MAHALLE_ID_PARAM));

  const iller = await fetchIller();
  let ilId = ilSlug ? findLocationIdBySlug(iller, ilSlug) : "";
  if (!ilId && legacyIlId != null && iller.some((row) => row.id === legacyIlId)) {
    ilId = String(legacyIlId);
  }

  const parsedIlId = parseLocationId(ilId);
  let ilceId = "";
  if (parsedIlId != null && (ilceSlug || legacyIlceId != null)) {
    const ilceler = await fetchIlcelerByIlId(parsedIlId);
    if (ilceSlug) {
      ilceId = findLocationIdBySlug(ilceler, ilceSlug);
    } else if (legacyIlceId != null && ilceler.some((row) => row.id === legacyIlceId)) {
      ilceId = String(legacyIlceId);
    }
  }

  const parsedIlceId = parseLocationId(ilceId);
  let mahalleId = "";
  if (parsedIlceId != null && (mahalleSlug || legacyMahalleId != null)) {
    const mahalleler = await fetchMahallelerByIlceId(parsedIlceId);
    if (mahalleSlug) {
      mahalleId = findLocationIdBySlug(mahalleler, mahalleSlug);
    } else if (legacyMahalleId != null && mahalleler.some((row) => row.id === legacyMahalleId)) {
      mahalleId = String(legacyMahalleId);
    }
  }

  return normalizeLocationValue({ ilId, ilceId, mahalleId });
}

export async function writeCategoryLocationToSearch(
  currentSearch: string,
  location: CategoryLocationFilterValue,
): Promise<string> {
  const params = readSearchParams(currentSearch);
  params.delete(IL_SLUG_PARAM);
  params.delete(ILCE_SLUG_PARAM);
  params.delete(MAHALLE_SLUG_PARAM);
  params.delete(LEGACY_IL_ID_PARAM);
  params.delete(LEGACY_ILCE_ID_PARAM);
  params.delete(LEGACY_MAHALLE_ID_PARAM);

  const normalized = normalizeLocationValue(location);
  const iller = await fetchIller();
  const defaultIlId = findLocationIdByAd(iller, HOME_DEFAULT_CITY_AD);
  const selectedIlId = parseLocationId(normalized.ilId) ?? parseLocationId(defaultIlId);
  const selectedIlceId = parseLocationId(normalized.ilceId);
  const selectedMahalleId = parseLocationId(normalized.mahalleId);
  const isDefaultAnkaraOnly =
    (normalized.ilId === "" || normalized.ilId === defaultIlId) &&
    selectedIlceId == null &&
    selectedMahalleId == null;

  if (!isDefaultAnkaraOnly && selectedIlId != null) {
    const ilSlug = findLocationSlugById(iller, selectedIlId);
    if (ilSlug) params.set(IL_SLUG_PARAM, ilSlug);
  }

  if (selectedIlId != null && selectedIlceId != null) {
    const ilceler = await fetchIlcelerByIlId(selectedIlId);
    const ilceSlug = findLocationSlugById(ilceler, selectedIlceId);
    if (ilceSlug) params.set(ILCE_SLUG_PARAM, ilceSlug);
  }

  if (selectedIlceId != null && selectedMahalleId != null) {
    const mahalleler = await fetchMahallelerByIlceId(selectedIlceId);
    const mahalleSlug = findLocationSlugById(mahalleler, selectedMahalleId);
    if (mahalleSlug) params.set(MAHALLE_SLUG_PARAM, mahalleSlug);
  }

  return params.toString();
}

async function replaceLocationSearch(location: CategoryLocationFilterValue) {
  if (typeof window === "undefined") return;
  const nextSearch = await writeCategoryLocationToSearch(window.location.search, location);
  applyLocationSearch(nextSearch);
}

export async function resolveCategoryListingIlId(ilId: string): Promise<number | null> {
  const selected = parseLocationId(ilId);
  if (selected != null) return selected;
  const iller = await fetchIller();
  return parseLocationId(findLocationIdByAd(iller, HOME_DEFAULT_CITY_AD));
}

export function useCategoryLocationFilterState(): {
  location: CategoryLocationFilterValue;
  setLocation: (next: CategoryLocationFilterValue) => void;
  locationReady: boolean;
} {
  const [location, setLocationState] = useState<CategoryLocationFilterValue>(
    EMPTY_CATEGORY_LOCATION_FILTER,
  );
  const [locationReady, setLocationReady] = useState(false);
  const writeGenerationRef = useRef(0);

  const syncLocationFromSearch = useCallback(async (search: string, normalizeUrl: boolean) => {
    const resolved = await resolveCategoryLocationFromSearch(search);
    setLocationState(resolved);
    if (normalizeUrl) {
      const generation = ++writeGenerationRef.current;
      const nextSearch = await writeCategoryLocationToSearch(search, resolved);
      if (generation !== writeGenerationRef.current) return;
      applyLocationSearch(nextSearch);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const search = typeof window === "undefined" ? "" : window.location.search;
        const resolved = await resolveCategoryLocationFromSearch(search);
        if (cancelled) return;
        setLocationState(resolved);
        const generation = ++writeGenerationRef.current;
        const nextSearch = await writeCategoryLocationToSearch(search, resolved);
        if (!cancelled && generation === writeGenerationRef.current) {
          applyLocationSearch(nextSearch);
        }
      } finally {
        if (!cancelled) setLocationReady(true);
      }
    })();

    const onPopState = () => {
      void syncLocationFromSearch(window.location.search, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onPopState);
    };
  }, [syncLocationFromSearch]);

  const setLocation = useCallback((next: CategoryLocationFilterValue) => {
    const normalized = normalizeLocationValue(next);
    setLocationState(normalized);
    const generation = ++writeGenerationRef.current;
    void (async () => {
      if (typeof window === "undefined") return;
      const nextSearch = await writeCategoryLocationToSearch(window.location.search, normalized);
      if (generation !== writeGenerationRef.current) return;
      applyLocationSearch(nextSearch);
    })();
  }, []);

  return { location, setLocation, locationReady };
}
