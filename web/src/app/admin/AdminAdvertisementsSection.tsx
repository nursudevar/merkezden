"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminAdvertisementForm } from "@/app/admin/AdminAdvertisementForm";
import { Card, CardContent } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countPlacementOccupancy,
  deleteAdvertisement,
  fetchAdPlacements,
  fetchAdminAdvertisements,
  fetchPlacementAssignments,
  getAdvertisementMediaPublicUrl,
  reorderPlacementAdvertisements,
  type AdAssignmentRecord,
  type AdPlacementRecord,
  type AdvertisementRecord,
} from "@/lib/advertisementsClient";

type AdsTab = "overview" | "all" | "institution_category" | "instructor" | "home_detail";
type PlacementGroup = "home" | "institution_category" | "instructor";
type PublicationStatus = "active" | "scheduled" | "inactive" | "expired";

const PLACEMENT_CAPACITY = 10;
const ADS_PAGE_SIZE = 10;

const STATUS_LABEL: Record<PublicationStatus, string> = {
  active: "Yayında",
  scheduled: "Planlanan",
  inactive: "Pasif",
  expired: "Süresi doldu",
};

function topGroupOf(placement: AdPlacementRecord): PlacementGroup {
  if (placement.placementType === "institution_category") return "institution_category";
  if (placement.placementType === "home") return "home";
  return "instructor";
}

function placementName(placement: AdPlacementRecord): string {
  if (placement.placementType === "home") return "Ana Sayfa Banner";
  if (placement.placementType === "instructor_general") return "Eğitmenler Genel";
  if (placement.placementType === "institution_category") {
    return placement.institutionCategoryName || placement.placementKey;
  }
  return placement.instructorCategoryName || placement.placementKey;
}

function categoryName(placement: AdPlacementRecord): string | null {
  if (placement.placementType === "institution_category") return placement.institutionCategoryName;
  if (placement.placementType === "instructor_category") return placement.instructorCategoryName;
  return null;
}

function comparePlacements(left: AdPlacementRecord, right: AdPlacementRecord): number {
  if (left.placementType === "instructor_general") return -1;
  if (right.placementType === "instructor_general") return 1;
  return placementName(left).localeCompare(placementName(right), "tr");
}

function firstPlacement(list: AdPlacementRecord[], group?: PlacementGroup): AdPlacementRecord | null {
  const scoped = group ? list.filter((placement) => topGroupOf(placement) === group) : list;
  const home = scoped.find((placement) => placement.placementType === "home");
  if (home) return home;
  return [...scoped].sort(comparePlacements)[0] ?? null;
}

function advertiserKind(ad: AdvertisementRecord): string {
  if (ad.advertiserType === "institution") return "Kurum";
  if (ad.advertiserType === "instructor") return "Eğitmen";
  return "Platform";
}

function advertiserLabel(ad: AdvertisementRecord): string {
  if (ad.advertiserType === "platform") return "Merkezden";
  return `${advertiserKind(ad)} · ${advertiserName(ad)}`;
}

function advertiserName(ad: AdvertisementRecord): string {
  if (ad.advertiserType === "institution") return ad.institutionName || "Kurum";
  if (ad.advertiserType === "instructor") return ad.instructorName || "Eğitmen";
  return "—";
}

function mediaTypeLabel(ad: AdvertisementRecord): string {
  return ad.mediaType === "video" ? "Video" : "Görsel";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(date);
}

function formatWindow(assignment: AdAssignmentRecord): string {
  if (!assignment.startsAt && !assignment.endsAt) return "Tarih sınırı yok";
  const start = assignment.startsAt ? formatDate(assignment.startsAt) : "Hemen";
  const end = assignment.endsAt ? formatDate(assignment.endsAt) : "Süresiz";
  return `${start} – ${end}`;
}

function windowState(assignment: AdAssignmentRecord, nowMs: number): "current" | "future" | "expired" {
  const endsAt = assignment.endsAt ? Date.parse(assignment.endsAt) : Number.NaN;
  if (assignment.endsAt && Number.isFinite(endsAt) && endsAt <= nowMs) return "expired";
  const startsAt = assignment.startsAt ? Date.parse(assignment.startsAt) : Number.NaN;
  if (assignment.startsAt && Number.isFinite(startsAt) && startsAt > nowMs) return "future";
  return "current";
}

function assignmentPublicationStatus(
  ad: AdvertisementRecord,
  assignment: AdAssignmentRecord,
  nowMs: number,
): PublicationStatus {
  if (!ad.isActive) return "inactive";
  const state = windowState(assignment, nowMs);
  if (state === "future") return "scheduled";
  if (state === "expired") return "expired";
  return "active";
}

function publicationStatus(ad: AdvertisementRecord, nowMs: number): PublicationStatus {
  if (!ad.isActive) return "inactive";
  const states = ad.assignments.map((assignment) => windowState(assignment, nowMs));
  if (states.includes("current")) return "active";
  if (states.includes("future")) return "scheduled";
  if (states.length > 0 && states.every((state) => state === "expired")) return "expired";
  return "active";
}

export function AdminAdvertisementsSection() {
  const [tab, setTab] = useState<AdsTab>("overview");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [ads, setAds] = useState<AdvertisementRecord[]>([]);
  const [placements, setPlacements] = useState<AdPlacementRecord[]>([]);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementQuery, setPlacementQuery] = useState("");
  const [placementDetailOpen, setPlacementDetailOpen] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [assignmentRows, setAssignmentRows] = useState<AdAssignmentRecord[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignmentReloadKey, setAssignmentReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [advertiserFilter, setAdvertiserFilter] = useState("all");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adsPage, setAdsPage] = useState(1);
  const [adsPageInput, setAdsPageInput] = useState("1");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdvertisementRecord | null>(null);
  const [createPlacementId, setCreatePlacementId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adToDelete, setAdToDelete] = useState<AdvertisementRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const [reordering, setReordering] = useState(false);
  const reorderingRef = useRef(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [draggedAssignmentId, setDraggedAssignmentId] = useState<string | null>(null);
  const [dragOverAssignmentId, setDragOverAssignmentId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedPlacementId;
  }, [selectedPlacementId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [adsResult, placementsResult] = await Promise.all([
        fetchAdminAdvertisements(),
        fetchAdPlacements(),
      ]);
      if (cancelled) return;
      if (adsResult.error) {
        setAds([]);
        setAdsError(adsResult.error);
      } else {
        setAds(adsResult.data ?? []);
        setAdsError(null);
      }
      if (placementsResult.error) {
        setPlacements([]);
        setPlacementsError(placementsResult.error);
        setAssignmentsLoading(false);
      } else {
        const list = placementsResult.data ?? [];
        const currentId = selectedIdRef.current;
        const nextId =
          currentId && list.some((placement) => placement.id === currentId)
            ? currentId
            : (firstPlacement(list)?.id ?? null);
        setPlacements(list);
        setPlacementsError(null);
        setSelectedPlacementId(nextId);
        if (nextId !== currentId) setAssignmentsLoading(Boolean(nextId));
      }
      setNowMs(Date.now());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedPlacementId) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchPlacementAssignments(selectedPlacementId);
      if (cancelled) return;
      if (result.error) {
        setAssignmentRows([]);
        setAssignmentsError(result.error);
      } else {
        setAssignmentRows(result.data ?? []);
        setAssignmentsError(null);
      }
      setAssignmentsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentReloadKey, reloadKey, selectedPlacementId]);

  const adsById = useMemo(() => new Map(ads.map((ad) => [ad.id, ad])), [ads]);

  const occupancyByPlacement = useMemo(() => {
    const counts = new Map<string, number>();
    for (const placement of placements) {
      counts.set(
        placement.id,
        countPlacementOccupancy(
          ads.flatMap((ad) =>
            ad.assignments
              .filter((assignment) => assignment.placementId === placement.id)
              .map((assignment) => ({
                endsAt: assignment.endsAt,
                advertisementIsActive: ad.isActive,
              })),
          ),
          nowMs,
        ),
      );
    }
    return counts;
  }, [ads, nowMs, placements]);

  const statusCounts = useMemo(() => {
    const counts: Record<PublicationStatus, number> = { active: 0, scheduled: 0, inactive: 0, expired: 0 };
    for (const ad of ads) counts[publicationStatus(ad, nowMs)] += 1;
    return counts;
  }, [ads, nowMs]);

  const groupStats = useMemo(() => {
    const build = (group: PlacementGroup) => {
      const rows = placements.filter((placement) => topGroupOf(placement) === group);
      const used = rows.reduce((sum, placement) => sum + (occupancyByPlacement.get(placement.id) ?? 0), 0);
      return { rows, used, capacity: rows.length * PLACEMENT_CAPACITY };
    };
    return {
      home: build("home"),
      institution_category: build("institution_category"),
      instructor: build("instructor"),
    };
  }, [occupancyByPlacement, placements]);

  const totalOccupied = groupStats.home.used + groupStats.institution_category.used + groupStats.instructor.used;
  const totalCapacity =
    groupStats.home.capacity + groupStats.institution_category.capacity + groupStats.instructor.capacity;

  const advertiserOptions = useMemo(() => {
    return [...new Set(ads.map(advertiserName).filter((name) => name !== "—"))].sort((a, b) =>
      a.localeCompare(b, "tr"),
    );
  }, [ads]);

  const typeOptions = useMemo(() => {
    const types = new Set(ads.map((ad) => ad.advertiserType).filter((type) => type != null));
    return [
      ads.some((ad) => ad.advertiserType == null) ? { value: "platform", label: "Platform" } : null,
      types.has("institution") ? { value: "institution", label: "Kurum" } : null,
      types.has("instructor") ? { value: "instructor", label: "Eğitmen" } : null,
    ].filter((option): option is { value: string; label: string } => option != null);
  }, [ads]);

  const categoryOptions = useMemo(() => {
    return [
      ...new Set(placements.map(categoryName).filter((name): name is string => Boolean(name))),
    ].sort((a, b) => a.localeCompare(b, "tr"));
  }, [placements]);

  const filteredAds = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    return ads.filter((ad) => {
      const status = publicationStatus(ad, nowMs);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (typeFilter === "platform" && ad.advertiserType != null) return false;
      if (typeFilter !== "all" && typeFilter !== "platform" && ad.advertiserType !== typeFilter) return false;
      if (advertiserFilter !== "all" && advertiserName(ad) !== advertiserFilter) return false;
      const assigned = placements.filter((placement) =>
        ad.assignments.some((assignment) => assignment.placementId === placement.id),
      );
      if (placementFilter !== "all" && !assigned.some((placement) => placement.id === placementFilter)) {
        return false;
      }
      if (categoryFilter !== "all" && !assigned.some((placement) => categoryName(placement) === categoryFilter)) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        ad.title,
        ad.description,
        advertiserName(ad),
        ...assigned.map(placementName),
        ...ad.buttons.map((button) => button.label),
      ]
        .join(" ")
        .toLocaleLowerCase("tr");
      return haystack.includes(needle);
    });
  }, [ads, advertiserFilter, categoryFilter, nowMs, placementFilter, placements, search, statusFilter, typeFilter]);

  const adsPageCount = Math.max(1, Math.ceil(filteredAds.length / ADS_PAGE_SIZE) || 1);
  const safeAdsPage = Math.min(adsPage, adsPageCount);

  useEffect(() => {
    if (adsPage !== safeAdsPage) setAdsPage(safeAdsPage);
  }, [adsPage, safeAdsPage]);

  useEffect(() => {
    setAdsPageInput(String(safeAdsPage));
  }, [safeAdsPage]);

  useEffect(() => {
    setAdsPage(1);
  }, [search, typeFilter, advertiserFilter, placementFilter, categoryFilter, statusFilter]);

  const pagedAds = useMemo(() => {
    const start = (safeAdsPage - 1) * ADS_PAGE_SIZE;
    return filteredAds.slice(start, start + ADS_PAGE_SIZE);
  }, [filteredAds, safeAdsPage]);

  const adsRangeStart = filteredAds.length === 0 ? 0 : (safeAdsPage - 1) * ADS_PAGE_SIZE + 1;
  const adsRangeEnd = Math.min(safeAdsPage * ADS_PAGE_SIZE, filteredAds.length);

  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) ?? null;
  const homePlacement = placements.find((placement) => placement.placementType === "home") ?? null;

  const groupPlacements = useMemo(() => {
    if (tab !== "institution_category" && tab !== "instructor") return [];
    return placements.filter((placement) => topGroupOf(placement) === tab).sort(comparePlacements);
  }, [placements, tab]);

  const visiblePlacementOptions = useMemo(() => {
    const needle = placementQuery.trim().toLocaleLowerCase("tr");
    const matched = needle
      ? groupPlacements.filter((placement) =>
          placementName(placement).toLocaleLowerCase("tr").includes(needle),
        )
      : groupPlacements;
    if (
      selectedPlacement &&
      (tab === "institution_category" || tab === "instructor") &&
      topGroupOf(selectedPlacement) === tab &&
      !matched.some((placement) => placement.id === selectedPlacement.id)
    ) {
      return [selectedPlacement, ...matched];
    }
    return matched;
  }, [groupPlacements, placementQuery, selectedPlacement, tab]);

  const choosePlacement = (placementId: string) => {
    if (reorderingRef.current) return;
    setOrderError(null);
    setPlacementDetailOpen(true);
    if (placementId === selectedPlacementId) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    setAssignmentRows([]);
    setSelectedPlacementId(placementId);
  };

  const openPlacementDetail = (placement: AdPlacementRecord) => {
    if (reorderingRef.current) return;
    setOrderError(null);
    setPlacementQuery("");
    setPlacementDetailOpen(true);
    if (placement.placementType === "home") {
      setTab("home_detail");
    } else if (placement.placementType === "institution_category") {
      setTab("institution_category");
    } else {
      setTab("instructor");
    }
    if (placement.id === selectedPlacementId) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    setAssignmentRows([]);
    setSelectedPlacementId(placement.id);
  };

  const closePlacementDetail = () => {
    if (reorderingRef.current) return;
    setPlacementDetailOpen(false);
  };

  const openHomeTab = () => {
    if (reorderingRef.current) return;
    setOrderError(null);
    setPlacementQuery("");
    setPlacementDetailOpen(false);
    setTab("home_detail");
    if (!homePlacement) return;
    if (homePlacement.id === selectedPlacementId) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    setAssignmentRows([]);
    setSelectedPlacementId(homePlacement.id);
  };

  const persistAssignmentOrder = async (
    placementId: string,
    previous: AdAssignmentRecord[],
    next: AdAssignmentRecord[],
  ) => {
    if (reorderingRef.current || next.length < 2) return;
    reorderingRef.current = true;
    setReordering(true);
    setOrderError(null);
    setAssignmentRows(next);
    const result = await reorderPlacementAdvertisements({
      placementId,
      assignmentIds: next.map((row) => row.id),
    });
    if (selectedIdRef.current !== placementId) {
      reorderingRef.current = false;
      setReordering(false);
      return;
    }
    if (result.error) {
      setAssignmentRows(previous);
      setOrderError(result.error);
      reorderingRef.current = false;
      setReordering(false);
      return;
    }
    const refreshed = await fetchPlacementAssignments(placementId);
    if (selectedIdRef.current !== placementId) {
      reorderingRef.current = false;
      setReordering(false);
      return;
    }
    if (refreshed.error) {
      setOrderError("Sıra kaydedildi, güncel liste alınamadı.");
    } else {
      setAssignmentRows(refreshed.data ?? []);
    }
    reorderingRef.current = false;
    setReordering(false);
  };

  const moveAssignment = (fromIndex: number, toIndex: number) => {
    if (!selectedPlacementId || reorderingRef.current || assignmentRows.length < 2) return;
    if (toIndex < 0 || toIndex >= assignmentRows.length || fromIndex === toIndex) return;
    const next = [...assignmentRows];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    void persistAssignmentOrder(selectedPlacementId, assignmentRows, next);
  };

  const dropAssignment = (targetId: string) => {
    const sourceId = draggedAssignmentId;
    setDraggedAssignmentId(null);
    setDragOverAssignmentId(null);
    if (!sourceId || sourceId === targetId) return;
    const fromIndex = assignmentRows.findIndex((row) => row.id === sourceId);
    const toIndex = assignmentRows.findIndex((row) => row.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    moveAssignment(fromIndex, toIndex);
  };

  const openCreate = (placementId?: string | null) => {
    setNotice(null);
    setEditingAd(null);
    setCreatePlacementId(placementId ?? null);
    setEditorOpen(true);
  };

  const openEdit = (ad: AdvertisementRecord) => {
    setNotice(null);
    setEditingAd(ad);
    setCreatePlacementId(null);
    setEditorOpen(true);
  };

  const confirmDelete = async () => {
    if (!adToDelete || deletingRef.current) return;
    const mediaPath = adToDelete.mediaPath;
    const adId = adToDelete.id;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteAdvertisement(adId);
    if (result.error) {
      setDeleteError(result.error);
      deletingRef.current = false;
      setDeleting(false);
      return;
    }
    let message = "Reklam silindi.";
    if (mediaPath) {
      const cleanupError = await requestMediaCleanup(mediaPath);
      if (cleanupError) message = `Reklam silindi. ${cleanupError}`;
    }
    deletingRef.current = false;
    setDeleting(false);
    setAdToDelete(null);
    if (editingAd?.id === adId) setEditorOpen(false);
    setNotice(message);
    setLoading(true);
    setAssignmentsLoading(true);
    setReloadKey((value) => value + 1);
  };

  const retry = () => {
    setLoading(true);
    setAssignmentsLoading(true);
    setAdsError(null);
    setPlacementsError(null);
    setReloadKey((value) => value + 1);
  };

  const goToAdsPage = () => {
    const parsed = Number.parseInt(adsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setAdsPageInput(String(safeAdsPage));
      return;
    }
    setAdsPage(Math.min(adsPageCount, Math.max(1, parsed)));
  };

  const selectedUsed = selectedPlacement ? (occupancyByPlacement.get(selectedPlacement.id) ?? 0) : 0;
  const selectedRemaining = Math.max(0, PLACEMENT_CAPACITY - selectedUsed);
  const showGroupCards =
    (tab === "institution_category" || tab === "instructor") && !placementDetailOpen;
  const showOrdering =
    selectedPlacement != null &&
    ((tab === "home_detail" && selectedPlacement.placementType === "home") ||
      (placementDetailOpen &&
        (tab === "institution_category" || tab === "instructor") &&
        topGroupOf(selectedPlacement) === tab));

  return (
    <Card className="admin-main-card">
      <CardContent className="admin-main-card-content admin-main-card-content--ads">
        <div className="admin-main-card-header admin-main-card-header--ads">
          <div>
            <h1 className="admin-main-card-title">Reklam Yönetimi</h1>
            <p className="admin-main-card-subtitle">Reklam ve yayın alanlarını yönet</p>
          </div>
          <button
            type="button"
            className="egitmen-panel-announcements-add-btn"
            onClick={() => openCreate()}
            disabled={loading}
          >
            + Yeni Reklam Ekle
          </button>
        </div>

        <div className="admin-ads-tabs" role="tablist" aria-label="Reklam yönetimi sekmeleri">
          {(
            [
              ["overview", "Genel Bakış"],
              ["all", "Tüm Reklamlar"],
              ["home_detail", "Ana Sayfa Reklamları"],
              ["institution_category", "Kurum Kategorileri"],
              ["instructor", "Eğitmenler"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`admin-ads-tab${tab === id ? " admin-ads-tab--active" : ""}`}
              onClick={() => {
                if (reorderingRef.current) return;
                if (id === "home_detail") {
                  openHomeTab();
                  return;
                }
                setTab(id);
                setPlacementQuery("");
                setPlacementDetailOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {notice ? (
          <p className="admin-ads-note" role="status">
            {notice}
          </p>
        ) : null}
        {loading ? <p className="admin-ads-note">Yükleniyor...</p> : null}

        {!loading && tab === "overview" ? (
          <section className="admin-ads-overview" aria-label="Genel bakış">
            {placementsError ? <AdsMessage message={placementsError} onRetry={retry} /> : null}
            <div className="admin-ads-overview-card">
              <div className="admin-ads-overview-head">
                <div>
                  <h2>Reklam kapasitesinin özeti</h2>
                  <p>
                    Toplam {totalOccupied.toLocaleString("tr-TR")} / {totalCapacity.toLocaleString("tr-TR")} dolu
                  </p>
                </div>
              </div>
              <div className="admin-ads-overview-rows">
                {(
                  [
                    ["home", "Ana Sayfa", groupStats.home],
                    ["institution_category", "Kurum Kategorileri", groupStats.institution_category],
                    ["instructor", "Eğitmenler", groupStats.instructor],
                  ] as const
                ).map(([id, label, stats]) => (
                  <div key={id} className="admin-ads-overview-row">
                    <div className="admin-ads-overview-row-top">
                      <span>{label}</span>
                      <strong>
                        {stats.used} / {stats.capacity}
                      </strong>
                    </div>
                    <span
                      className="admin-ads-progress"
                      aria-hidden="true"
                      style={{
                        ["--admin-ads-progress" as string]: `${
                          stats.capacity > 0 ? (stats.used / stats.capacity) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="admin-ads-overview-status">
                <span>{statusCounts.active} yayında</span>
                <span>{statusCounts.scheduled} planlanan</span>
                <span>{statusCounts.inactive} pasif</span>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && tab === "all" ? (
          adsError ? (
            <AdsMessage message={adsError} onRetry={retry} />
          ) : (
            <section className="admin-ads-all" aria-label="Tüm reklamlar">
              <div className="admin-ads-list-head">
                <div>
                  <h2>Tüm Reklamlar</h2>
                  <span>{filteredAds.length.toLocaleString("tr-TR")} reklam kaydı</span>
                </div>
              </div>
              <div className="admin-ads-filters">
                <label className="admin-ads-field admin-ads-field--search">
                  <span>Ara</span>
                  <input
                    className="admin-ads-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Reklam adı, açıklama veya reklamveren ara..."
                    aria-label="Reklam ara"
                  />
                </label>
                <div className="admin-ads-filters-selects">
                  <AdsSelect
                    label="Durum"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "Tümü" },
                      { value: "active", label: "Yayında" },
                      { value: "scheduled", label: "Planlanan" },
                      { value: "inactive", label: "Pasif" },
                      ...(statusCounts.expired > 0
                        ? [{ value: "expired", label: "Süresi doldu" }]
                        : []),
                    ]}
                  />
                  {placements.length > 0 ? (
                    <AdsSelect
                      label="Yayın Alanı"
                      value={placementFilter}
                      onChange={setPlacementFilter}
                      options={[
                        { value: "all", label: "Tümü" },
                        ...[...placements].sort(comparePlacements).map((placement) => ({
                          value: placement.id,
                          label: placementName(placement),
                        })),
                      ]}
                    />
                  ) : null}
                  {advertiserOptions.length > 0 ? (
                    <AdsSelect
                      label="Reklamveren"
                      value={advertiserFilter}
                      onChange={setAdvertiserFilter}
                      options={[
                        { value: "all", label: "Tümü" },
                        ...advertiserOptions.map((name) => ({ value: name, label: name })),
                      ]}
                    />
                  ) : null}
                  {typeOptions.length > 0 ? (
                    <AdsSelect
                      label="Tür"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      options={[{ value: "all", label: "Tümü" }, ...typeOptions]}
                    />
                  ) : null}
                  {categoryOptions.length > 0 ? (
                    <AdsSelect
                      label="Kategori"
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={[
                        { value: "all", label: "Tümü" },
                        ...categoryOptions.map((name) => ({ value: name, label: name })),
                      ]}
                    />
                  ) : null}
                </div>
              </div>

              {ads.length === 0 ? (
                <p className="admin-ads-note">Henüz reklam yok.</p>
              ) : filteredAds.length === 0 ? (
                <p className="admin-ads-note">Bu filtrelere uyan reklam yok.</p>
              ) : (
                <>
                  <ul className="admin-ads-card-list">
                    {pagedAds.map((ad) => {
                      const assigned = placements
                        .filter((placement) =>
                          ad.assignments.some((assignment) => assignment.placementId === placement.id),
                        )
                        .sort(comparePlacements);
                      const status = publicationStatus(ad, nowMs);
                      return (
                        <li key={ad.id} className="admin-ads-ad-card">
                          <MediaThumb
                            url={getAdvertisementMediaPublicUrl(ad.mediaPath)}
                            mediaType={ad.mediaType}
                            large
                          />
                          <div className="admin-ads-ad-card-body">
                            <div className="admin-ads-ad-card-main">
                              <h3>{ad.title || "Başlıksız reklam"}</h3>
                              <p className="admin-ads-kind">
                                {advertiserLabel(ad)} · {mediaTypeLabel(ad)}
                              </p>
                              {ad.description.trim() ? (
                                <p className="admin-ads-ad-card-desc">{ad.description}</p>
                              ) : null}
                              <div className="admin-ads-ad-card-badges">
                                <StatusBadge status={status} />
                                <span className={`admin-ads-chip${ad.isActive ? " admin-ads-chip--ok" : ""}`}>
                                  {ad.isActive ? "Merkezi aktif" : "Merkezi pasif"}
                                </span>
                                <span className="admin-ads-chip">
                                  {assigned.length > 0
                                    ? `${assigned.length} yayın alanı`
                                    : "Atanmadı"}
                                </span>
                              </div>
                              <div className="admin-ads-button-preview">
                                <span>Reklam butonları</span>
                                {ad.buttons.length > 0 ? (
                                  <div>
                                    {ad.buttons.slice(0, 2).map((button, index) => (
                                      <span
                                        key={`${button.label}-${button.url}-${index}`}
                                        className={`admin-ads-button-chip${
                                          index === 1 ? " admin-ads-button-chip--secondary" : ""
                                        }`}
                                        title={button.url}
                                      >
                                        {button.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <em>Bu reklam için buton tanımlanmamış</em>
                                )}
                              </div>
                              {assigned.length > 0 ? (
                                <p className="admin-ads-ad-card-placements">
                                  {assigned.map(placementName).join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="admin-ads-row-actions">
                              <button
                                type="button"
                                className="admin-approval-requests-filter-btn"
                                onClick={() => openEdit(ad)}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                className="admin-ads-delete-btn"
                                onClick={() => {
                                  setDeleteError(null);
                                  setAdToDelete(ad);
                                }}
                                disabled={deleting}
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="admin-announcements-pagination">
                    <p className="admin-announcements-pagination-info">
                      {`${adsRangeStart} - ${adsRangeEnd} / ${filteredAds.length} reklam gösteriliyor`}
                    </p>
                    <div className="admin-announcements-pagination-controls">
                      <button
                        type="button"
                        className="admin-announcements-page-btn"
                        disabled={safeAdsPage <= 1}
                        onClick={() => setAdsPage((prev) => Math.max(1, prev - 1))}
                      >
                        ‹
                      </button>
                      <span className="admin-announcements-page-indicator">
                        {safeAdsPage} / {adsPageCount}
                      </span>
                      <button
                        type="button"
                        className="admin-announcements-page-btn"
                        disabled={safeAdsPage >= adsPageCount}
                        onClick={() => setAdsPage((prev) => Math.min(adsPageCount, prev + 1))}
                      >
                        ›
                      </button>
                      <div className="admin-announcements-page-jump">
                        <span className="admin-announcements-page-jump-label">Sayfaya git</span>
                        <input
                          type="number"
                          min={1}
                          max={adsPageCount}
                          className="admin-announcements-page-jump-input"
                          value={adsPageInput}
                          onChange={(event) => setAdsPageInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              goToAdsPage();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="admin-announcements-page-btn"
                          onClick={goToAdsPage}
                        >
                          Git
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )
        ) : null}

        {!loading && showGroupCards ? (
          placementsError ? (
            <AdsMessage message={placementsError} onRetry={retry} />
          ) : groupPlacements.length === 0 ? (
            <p className="admin-ads-note">Bu grupta yayın alanı yok.</p>
          ) : (
            <section className="admin-ads-group-tab" aria-label="Yayın alanları">
              <div className="admin-ads-group-toolbar">
                <div>
                  <h2>{tab === "institution_category" ? "Kurum Kategorileri" : "Eğitmenler"}</h2>
                  <p>
                    {(tab === "institution_category"
                      ? groupStats.institution_category.used
                      : groupStats.instructor.used
                    ).toLocaleString("tr-TR")}{" "}
                    /{" "}
                    {(tab === "institution_category"
                      ? groupStats.institution_category.capacity
                      : groupStats.instructor.capacity
                    ).toLocaleString("tr-TR")}{" "}
                    kullanılıyor
                  </p>
                </div>
                <div className="admin-ads-compact-select">
                  <input
                    value={placementQuery}
                    onChange={(event) => setPlacementQuery(event.target.value)}
                    placeholder="Alan ara..."
                    aria-label="Yayın alanı ara"
                  />
                  <Select
                    value={
                      selectedPlacement && topGroupOf(selectedPlacement) === tab
                        ? selectedPlacement.id
                        : undefined
                    }
                    onValueChange={choosePlacement}
                  >
                    <SelectTrigger className="admin-ads-select-trigger" aria-label="Yayın alanı seç">
                      <SelectValue placeholder="Yayın alanı seç" />
                    </SelectTrigger>
                    <SelectContent
                      className="admin-ads-select-content"
                      position="popper"
                      side="bottom"
                      sideOffset={6}
                      align="start"
                    >
                      {visiblePlacementOptions.map((placement) => (
                        <SelectItem key={placement.id} value={placement.id}>
                          {placementName(placement)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="admin-ads-capacity-grid">
                {visiblePlacementOptions.map((placement) => {
                  const used = occupancyByPlacement.get(placement.id) ?? 0;
                  const remaining = Math.max(0, PLACEMENT_CAPACITY - used);
                  return (
                    <button
                      key={placement.id}
                      type="button"
                      className="admin-ads-capacity-card"
                      onClick={() => openPlacementDetail(placement)}
                    >
                      <span className="admin-ads-capacity-card-top">
                        <span className="admin-ads-capacity-card-title">{placementName(placement)}</span>
                        <span className="admin-ads-capacity-card-chevron" aria-hidden="true">
                          ›
                        </span>
                      </span>
                      <span className="admin-ads-capacity-card-meta">
                        <span>
                          {remaining} boş yer
                          {!placement.isEnabled ? " · Kapalı" : ""}
                        </span>
                        <strong>
                          {used}/{PLACEMENT_CAPACITY}
                        </strong>
                      </span>
                      <span
                        className="admin-ads-progress"
                        aria-hidden="true"
                        style={{
                          ["--admin-ads-progress" as string]: `${(used / PLACEMENT_CAPACITY) * 100}%`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          )
        ) : null}

        {!loading && tab === "home_detail" && !homePlacement && !placementsError ? (
          <p className="admin-ads-note">Ana sayfa yayın alanı bulunamadı.</p>
        ) : null}

        {!loading && tab === "home_detail" && placementsError ? (
          <AdsMessage message={placementsError} onRetry={retry} />
        ) : null}

        {!loading && showOrdering && selectedPlacement ? (
          <div className="admin-ads-placement-view">
            {tab !== "home_detail" ? (
              <button type="button" className="admin-ads-back-btn" onClick={closePlacementDetail}>
                ← Yayın alanları
              </button>
            ) : null}
            {(tab === "institution_category" || tab === "instructor") && groupPlacements.length > 0 ? (
              <div className="admin-ads-compact-select">
                <input
                  value={placementQuery}
                  onChange={(event) => setPlacementQuery(event.target.value)}
                  placeholder="Alan ara..."
                  aria-label="Yayın alanı ara"
                />
                <Select value={selectedPlacement.id} onValueChange={choosePlacement}>
                  <SelectTrigger className="admin-ads-select-trigger" aria-label="Yayın alanı seç">
                    <SelectValue placeholder="Yayın alanı seç" />
                  </SelectTrigger>
                  <SelectContent
                    className="admin-ads-select-content"
                    position="popper"
                    side="bottom"
                    sideOffset={6}
                    align="start"
                  >
                    {visiblePlacementOptions.map((placement) => (
                      <SelectItem key={placement.id} value={placement.id}>
                        {placementName(placement)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="admin-ads-selected-detail">
              <p className="admin-ads-breadcrumb">
                {selectedPlacement.placementType === "home"
                  ? "Ana Sayfa Reklamları"
                  : tab === "institution_category"
                    ? "Kurum Kategorileri"
                    : "Eğitmenler"}
              </p>
              <div className="admin-ads-selected-detail-top">
                <div>
                  <h2>
                    {selectedPlacement.placementType === "home"
                      ? "Ana Sayfa Banner"
                      : placementName(selectedPlacement)}
                  </h2>
                  <span
                    className={`admin-ads-status-badge${
                      selectedPlacement.isEnabled ? " admin-ads-status-badge--active" : ""
                    }`}
                  >
                    {selectedPlacement.isEnabled ? "Açık" : "Kapalı"}
                  </span>
                </div>
                <div className="admin-ads-selected-capacity">
                  <strong>
                    {selectedUsed} / {PLACEMENT_CAPACITY}
                  </strong>
                  <span>Kullanılan reklam kapasitesi</span>
                  <span>{selectedRemaining} boş yer</span>
                </div>
              </div>
              <span
                className="admin-ads-progress admin-ads-progress--lg"
                aria-hidden="true"
                style={{
                  ["--admin-ads-progress" as string]: `${(selectedUsed / PLACEMENT_CAPACITY) * 100}%`,
                }}
              />
            </div>

            <div className="admin-ads-selected">
              <div>
                <h2>Bu Alandaki Reklamlar</h2>
                <p>Sürükleyerek veya oklarla sırala.</p>
              </div>
              <button
                type="button"
                className="admin-approval-requests-filter-btn"
                onClick={() => openCreate(selectedPlacement.id)}
              >
                {selectedPlacement.placementType === "home"
                  ? "+ Ana Sayfa Reklamı Ekle"
                  : "+ Reklam Ekle"}
              </button>
            </div>

            {orderError ? (
              <p className="admin-ads-order-error" role="alert">
                {orderError}
              </p>
            ) : null}
            {assignmentsLoading ? <p className="admin-ads-note">Yükleniyor...</p> : null}
            {!assignmentsLoading && assignmentsError ? (
              <AdsMessage
                message={assignmentsError}
                onRetry={() => {
                  setAssignmentsLoading(true);
                  setAssignmentsError(null);
                  setAssignmentReloadKey((value) => value + 1);
                }}
              />
            ) : null}
            {!assignmentsLoading && !assignmentsError && assignmentRows.length === 0 ? (
              <p className="admin-ads-note">Bu alanda atanmış reklam yok.</p>
            ) : null}
            {!assignmentsLoading && !assignmentsError && assignmentRows.length > 0 ? (
              <div className="admin-ads-table-wrap">
                <table className="admin-ads-table">
                  <thead>
                    <tr>
                      <th>Sıra</th>
                      <th>Reklam</th>
                      <th>Yayın tarihi</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentRows.map((assignment, index) => {
                      const ad = adsById.get(assignment.advertisementId);
                      const canReorder = assignmentRows.length > 1 && !reordering;
                      return (
                        <tr
                          key={assignment.id}
                          className={[
                            draggedAssignmentId === assignment.id ? "admin-ads-row--dragging" : "",
                            dragOverAssignmentId === assignment.id ? "admin-ads-row--drag-over" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onDragOver={(event) => {
                            if (!canReorder || !draggedAssignmentId) return;
                            event.preventDefault();
                            if (draggedAssignmentId !== assignment.id) {
                              setDragOverAssignmentId(assignment.id);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            dropAssignment(assignment.id);
                          }}
                        >
                          <td>
                            <div className="admin-ads-order-controls">
                              <span
                                className="admin-ads-drag-handle"
                                draggable={canReorder}
                                aria-hidden="true"
                                onDragStart={(event) => {
                                  if (!canReorder) return;
                                  event.dataTransfer.effectAllowed = "move";
                                  setDraggedAssignmentId(assignment.id);
                                }}
                                onDragEnd={() => {
                                  setDraggedAssignmentId(null);
                                  setDragOverAssignmentId(null);
                                }}
                              >
                                ⋮⋮
                              </span>
                              <span className="admin-ads-order-index">{index + 1}</span>
                              <button
                                type="button"
                                className="admin-ads-order-btn"
                                aria-label="Yukarı taşı"
                                disabled={!canReorder || index === 0}
                                onClick={() => moveAssignment(index, index - 1)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="admin-ads-order-btn"
                                aria-label="Aşağı taşı"
                                disabled={!canReorder || index === assignmentRows.length - 1}
                                onClick={() => moveAssignment(index, index + 1)}
                              >
                                ↓
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="admin-ads-identity">
                              <MediaThumb
                                url={ad ? getAdvertisementMediaPublicUrl(ad.mediaPath) : null}
                                mediaType={ad?.mediaType ?? "image"}
                              />
                              <span>
                                <span className="admin-ads-title">{ad?.title || "Reklam bulunamadı"}</span>
                                <span className="admin-ads-kind">{ad ? advertiserLabel(ad) : "—"}</span>
                              </span>
                            </div>
                          </td>
                          <td>{formatWindow(assignment)}</td>
                          <td>
                            {ad ? (
                              <StatusBadge
                                status={assignmentPublicationStatus(ad, assignment, nowMs)}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {ad ? (
                              <button
                                type="button"
                                className="admin-approval-requests-filter-btn"
                                onClick={() => openEdit(ad)}
                              >
                                Düzenle
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {adToDelete ? (
          <div
            className="egitmen-panel-confirm-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-ad-delete-title"
            onClick={() => {
              if (!deleting) setAdToDelete(null);
            }}
          >
            <div className="egitmen-panel-confirm-modal-content" onClick={(event) => event.stopPropagation()}>
              <h2 id="admin-ad-delete-title" className="egitmen-panel-confirm-modal-title">
                Reklamı Sil
              </h2>
              <div className="egitmen-panel-confirm-modal-body">
                <p className="egitmen-panel-confirm-modal-message">
                  <strong>{adToDelete.title || "Başlıksız reklam"}</strong> başlıklı reklamı silmek
                  istediğinize emin misiniz? Reklam, atandığı tüm yayın alanlarından kaldırılır. Bu
                  işlem geri alınamaz.
                </p>
                {deleteError ? (
                  <p className="egitmen-panel-announcement-modal-error" role="alert">
                    {deleteError}
                  </p>
                ) : null}
              </div>
              <div className="egitmen-panel-confirm-modal-footer">
                <button
                  type="button"
                  className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--cancel"
                  onClick={() => setAdToDelete(null)}
                  disabled={deleting}
                >
                  İptal
                </button>
                <button
                  type="button"
                  className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--danger"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                >
                  {deleting ? "Siliniyor..." : "Sil"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editorOpen ? (
          <AdminAdvertisementForm
            key={editingAd?.id ?? `new-${createPlacementId ?? "blank"}`}
            advertisement={editingAd}
            placements={placements}
            ads={ads}
            occupancyByPlacement={occupancyByPlacement}
            nowMs={nowMs}
            preselectedPlacementId={editingAd ? null : createPlacementId}
            onClose={() => {
              if (!editorOpen) return;
              setEditorOpen(false);
              setCreatePlacementId(null);
            }}
            onSaved={(message) => {
              setEditorOpen(false);
              setCreatePlacementId(null);
              setNotice(message);
              setLoading(true);
              setAssignmentsLoading(true);
              setReloadKey((value) => value + 1);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

async function requestMediaCleanup(path: string): Promise<string | null> {
  try {
    const response = await fetch("/api/admin/advertisements/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof body?.error === "string" ? body.error : "";
    return message || "Eski medya temizlenemedi.";
  } catch {
    return "Eski medya temizlenemedi.";
  }
}

function AdsSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="admin-ads-field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="admin-ads-select-trigger" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="admin-ads-select-content"
          position="popper"
          side="bottom"
          sideOffset={6}
          align="start"
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function StatusBadge({ status }: { status: PublicationStatus }) {
  return (
    <span
      className={`admin-ads-status-badge${
        status === "active"
          ? " admin-ads-status-badge--active"
          : status === "scheduled"
            ? " admin-ads-status-badge--scheduled"
            : status === "expired"
              ? " admin-ads-status-badge--expired"
              : ""
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function MediaThumb({
  url,
  mediaType,
  large = false,
}: {
  url: string | null;
  mediaType: AdvertisementRecord["mediaType"];
  large?: boolean;
}) {
  const className = `admin-ads-thumb${large ? " admin-ads-thumb--lg" : ""}`;
  if (!url) return <span className={`${className} admin-ads-thumb--empty`}>—</span>;
  if (mediaType === "video") {
    return (
      <span className="admin-ads-thumb-wrap">
        <video className={className} src={url} muted preload="metadata" />
        {large ? <span className="admin-ads-thumb-video">Video</span> : null}
      </span>
    );
  }
  return <img className={className} src={url} alt="" />;
}

function AdsMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="admin-ads-message">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Tekrar dene
      </button>
    </div>
  );
}
