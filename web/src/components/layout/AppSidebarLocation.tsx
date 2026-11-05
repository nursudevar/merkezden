"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { MapPin } from "lucide-react";
import {
  CATEGORY_ALL_ILCELER_VALUE,
  CATEGORY_ALL_MAHALLELER_VALUE,
  EMPTY_CATEGORY_LOCATION_FILTER,
  persistCategoryLocationPreference,
  resolvePreferredCategoryLocation,
  type CategoryLocationFilterValue,
} from "@/components/category/categoryLocationFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectMountGate,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  fetchIlcelerByIlId,
  fetchIller,
  fetchMahallelerByIlceId,
  parseLocationId,
  type TurkiyeLocationOption,
} from "@/lib/turkiyeLocationsClient";

type AppSidebarLocationProps = {
  expanded: boolean;
  /** Açık Radix Select → parent interactive region. */
  onSelectOpenChange?: (open: boolean) => void;
};

type LocationLabels = {
  ilAd: string;
  ilceAd: string;
  mahalleAd: string;
};

const EMPTY_LABELS: LocationLabels = { ilAd: "", ilceAd: "", mahalleAd: "" };

const selectContentClassName =
  "app-sidebar-location-select-content select-content-popper";

export function AppSidebarLocation({
  expanded,
  onSelectOpenChange,
}: AppSidebarLocationProps) {
  const editorId = useId();
  const [location, setLocation] = useState<CategoryLocationFilterValue>(EMPTY_CATEGORY_LOCATION_FILTER);
  const [labels, setLabels] = useState<LocationLabels>(EMPTY_LABELS);
  const [iller, setIller] = useState<TurkiyeLocationOption[]>([]);
  const [ilceler, setIlceler] = useState<TurkiyeLocationOption[]>([]);
  const [mahalleler, setMahalleler] = useState<TurkiyeLocationOption[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ilSelectOpen, setIlSelectOpen] = useState(false);
  const [ilceSelectOpen, setIlceSelectOpen] = useState(false);
  const [mahalleSelectOpen, setMahalleSelectOpen] = useState(false);

  const refreshLabels = useCallback(async (value: CategoryLocationFilterValue) => {
    const nextLabels: LocationLabels = { ...EMPTY_LABELS };
    const allIller = await fetchIller();
    const il = allIller.find((row) => String(row.id) === value.ilId);
    nextLabels.ilAd = il?.ad ?? "";

    const parsedIlId = parseLocationId(value.ilId);
    if (parsedIlId != null && value.ilceId) {
      const rows = await fetchIlcelerByIlId(parsedIlId);
      nextLabels.ilceAd = rows.find((row) => String(row.id) === value.ilceId)?.ad ?? "";
    }

    const parsedIlceId = parseLocationId(value.ilceId);
    if (parsedIlceId != null && value.mahalleId) {
      const rows = await fetchMahallelerByIlceId(parsedIlceId);
      nextLabels.mahalleAd = rows.find((row) => String(row.id) === value.mahalleId)?.ad ?? "";
    }

    setLabels(nextLabels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const search = typeof window !== "undefined" ? window.location.search : "";
        const resolved = await resolvePreferredCategoryLocation(search);
        if (cancelled) return;
        setLocation(resolved);
        await refreshLabels(resolved);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLabels]);

  // Sidebar daralınca editörü ve açık select'leri kapat
  useEffect(() => {
    if (expanded) return;
    setEditorOpen(false);
    setIlSelectOpen(false);
    setIlceSelectOpen(false);
    setMahalleSelectOpen(false);
  }, [expanded]);

  useEffect(() => {
    if (!editorOpen) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchIller();
      if (!cancelled) setIller(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [editorOpen]);

  useEffect(() => {
    if (!editorOpen) return;
    const parsedIlId = parseLocationId(location.ilId);
    if (parsedIlId == null) {
      setIlceler([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await fetchIlcelerByIlId(parsedIlId);
      if (!cancelled) setIlceler(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [editorOpen, location.ilId]);

  useEffect(() => {
    if (!editorOpen) return;
    const parsedIlceId = parseLocationId(location.ilceId);
    if (parsedIlceId == null) {
      setMahalleler([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await fetchMahallelerByIlceId(parsedIlceId);
      if (!cancelled) setMahalleler(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [editorOpen, location.ilceId]);

  const applyLocation = useCallback(
    async (next: CategoryLocationFilterValue) => {
      setLocation(next);
      await persistCategoryLocationPreference(next);
      await refreshLabels(next);
    },
    [refreshLabels],
  );

  const syncSelectOpen = useCallback(
    (which: "il" | "ilce" | "mahalle", open: boolean) => {
      const nextIl = which === "il" ? open : false;
      const nextIlce = which === "ilce" ? open : false;
      const nextMahalle = which === "mahalle" ? open : false;
      setIlSelectOpen(nextIl);
      setIlceSelectOpen(nextIlce);
      setMahalleSelectOpen(nextMahalle);
      onSelectOpenChange?.(nextIl || nextIlce || nextMahalle);
    },
    [onSelectOpenChange],
  );

  const summaryPrimary = loading
    ? "Konum"
    : `${labels.ilAd || "Şehir"}${labels.ilceAd ? ` / ${labels.ilceAd}` : " / Tüm İlçeler"}`;
  const summarySecondary = labels.mahalleAd || "Tüm Mahalleler";

  return (
    <div className={`app-sidebar-location${editorOpen ? " is-editing" : ""}`}>
      <button
        type="button"
        className="app-sidebar-location-trigger"
        aria-expanded={editorOpen}
        aria-controls={editorId}
        title={summaryPrimary}
        aria-label={`Konum: ${summaryPrimary}. Değiştirmek için aç.`}
        onClick={(e) => {
          e.stopPropagation();
          if (!expanded) return;
          setEditorOpen((prev) => !prev);
        }}
      >
        <span className="app-sidebar-location-icon" aria-hidden="true">
          <MapPin size={18} strokeWidth={1.85} />
        </span>
        <span className="app-sidebar-location-copy">
          <span className="app-sidebar-location-primary">{summaryPrimary}</span>
          <span className="app-sidebar-location-secondary">{summarySecondary}</span>
        </span>
        {expanded ? (
          <span className="app-sidebar-location-change" aria-hidden="true">
            Değiştir
          </span>
        ) : null}
      </button>

      {expanded && editorOpen ? (
        <div
          id={editorId}
          className="app-sidebar-location-editor"
          role="region"
          aria-label="Konum seçimi"
        >
          {/* label değil div: native <label> SelectTrigger'a ikinci click üretir → open/close. */}
          <div className="app-sidebar-location-field">
            <span className="app-sidebar-location-field-label" id={`${editorId}-il`}>
              İl
            </span>
            <SelectMountGate
              label={labels.ilAd || "İl seçin"}
              className="select-trigger-sm app-sidebar-location-select"
            >
              <Select
                value={location.ilId || undefined}
                open={ilSelectOpen}
                onOpenChange={(open) => syncSelectOpen("il", open)}
                onValueChange={(value) => {
                  void applyLocation({
                    ilId: value,
                    ilceId: "",
                    mahalleId: "",
                  });
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="app-sidebar-location-select"
                  aria-labelledby={`${editorId}-il`}
                >
                  <SelectValue placeholder="İl seçin" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  sideOffset={4}
                  collisionPadding={12}
                  className={selectContentClassName}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                  }}
                >
                  {iller.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectMountGate>
          </div>

          <div className="app-sidebar-location-field">
            <span className="app-sidebar-location-field-label" id={`${editorId}-ilce`}>
              İlçe
            </span>
            <SelectMountGate
              label={labels.ilceAd || "Tüm İlçeler"}
              disabled={!location.ilId}
              className="select-trigger-sm app-sidebar-location-select"
            >
              <Select
                value={location.ilceId || CATEGORY_ALL_ILCELER_VALUE}
                open={ilceSelectOpen}
                onOpenChange={(open) => syncSelectOpen("ilce", open)}
                onValueChange={(value) => {
                  const ilceId = value === CATEGORY_ALL_ILCELER_VALUE ? "" : value;
                  void applyLocation({
                    ilId: location.ilId,
                    ilceId,
                    mahalleId: "",
                  });
                }}
                disabled={!location.ilId}
              >
                <SelectTrigger
                  size="sm"
                  className="app-sidebar-location-select"
                  aria-labelledby={`${editorId}-ilce`}
                >
                  <SelectValue placeholder="Tüm İlçeler" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  sideOffset={4}
                  collisionPadding={12}
                  className={selectContentClassName}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                  }}
                >
                  <SelectItem value={CATEGORY_ALL_ILCELER_VALUE}>Tüm İlçeler</SelectItem>
                  {ilceler.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectMountGate>
          </div>

          <div className="app-sidebar-location-field">
            <span className="app-sidebar-location-field-label" id={`${editorId}-mahalle`}>
              Mahalle
            </span>
            <SelectMountGate
              label={labels.mahalleAd || "Tüm Mahalleler"}
              disabled={!location.ilceId}
              className="select-trigger-sm app-sidebar-location-select"
            >
              <Select
                value={location.mahalleId || CATEGORY_ALL_MAHALLELER_VALUE}
                open={mahalleSelectOpen}
                onOpenChange={(open) => syncSelectOpen("mahalle", open)}
                onValueChange={(value) => {
                  const mahalleId = value === CATEGORY_ALL_MAHALLELER_VALUE ? "" : value;
                  setLocation((prev) => ({ ...prev, mahalleId }));
                  void refreshLabels({ ...location, mahalleId });
                }}
                disabled={!location.ilceId}
              >
                <SelectTrigger
                  size="sm"
                  className="app-sidebar-location-select"
                  aria-labelledby={`${editorId}-mahalle`}
                >
                  <SelectValue placeholder="Tüm Mahalleler" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  align="start"
                  sideOffset={4}
                  collisionPadding={12}
                  className={selectContentClassName}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                  }}
                >
                  <SelectItem value={CATEGORY_ALL_MAHALLELER_VALUE}>Tüm Mahalleler</SelectItem>
                  {mahalleler.map((row) => (
                    <SelectItem key={row.id} value={String(row.id)}>
                      {row.ad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectMountGate>
          </div>
          <p className="app-sidebar-location-note">
            İl ve ilçe tercihiniz kaydedilir. Mahalle tercihi kalıcı olarak saklanmaz.
          </p>
        </div>
      ) : null}
    </div>
  );
}
