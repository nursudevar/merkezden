"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Card, CardContent } from "@/components/ui";
import {
  MapPin,
  GraduationCap,
  CheckCircle2,
  Star,
  Image as ImageIcon,
  BookOpen,
  Phone,
  Globe,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Play,
  GitCommitVertical,
  Sparkles,
  Megaphone,
  CalendarDays,
  ImageOff,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMebInstitution } from "@/lib/institutionHelpers";
import { formatWorkingHoursRange } from "@/lib/institutionWorkingHours";
import ShareButton from "./ShareButton";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";

type DbInstitutionRow = {
  id: number;
  slug: string | null;
  institution_name: string | null;
  type: string | null;
  institution_type: {
    name: string | null;
    category: { name: string | null; slug?: string | null } | null;
  } | Array<{ name: string | null; category: { name: string | null; slug?: string | null } | null }> | null;
  city: string | null;
  district: string | null;
  address: string | null;
  official_phone: string | null;
  website: string | null;
  subheading: string | null;
  about: string | null;
  logo: string | null;
  is_verified: boolean | null;
  source: string | null;
  working_hours_start?: string | null;
  working_hours_end?: string | null;
};

type InstitutionMediaImageRow = {
  id: number | string;
  media_type: string | null;
  file_url: string | null;
  file_path: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type InstitutionFeatureGroupRow = {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean;
  category_slug?: string | null;
};

type InstitutionFeatureDefinitionRow = {
  id: number;
  group_id: number;
  name: string;
  slug: string | null;
  input_type: "boolean" | "text" | "number" | "single_select" | "multi_select" | string;
  unit: string | null;
  display_order: number | null;
  is_active: boolean;
};

type InstitutionFeatureChoiceRow = {
  id: number;
  feature_definition_id: number;
  name: string | null;
  display_order: number | null;
  is_active: boolean;
};

type InstitutionFeatureEntryRow = {
  id: number;
  feature_definition_id: number;
  boolean_answer: boolean | null;
  text_answer: string | null;
  number_answer: number | null;
  selected_choice_id: number | null;
};

type InstitutionFeatureEntryChoiceRow = {
  institution_feature_entry_id: number;
  choice_id: number;
};

type PublicFeatureGroupSection = {
  id: number;
  name: string;
  badges: string[];
};

type AcademicFeatureLine = {
  label: string;
  value: string | string[];
  isBadgeList?: boolean;
};

type DetailBranch = "meb" | "auto" | "default";

const FALLBACK_LOGO_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'%3E%3Crect width='320' height='320' rx='28' fill='%23F1EEFF'/%3E%3Cpath d='M95 144c0-7.18 5.82-13 13-13h104c7.18 0 13 5.82 13 13v66c0 7.18-5.82 13-13 13H108c-7.18 0-13-5.82-13-13v-66z' fill='%236D5DFC' fill-opacity='.12'/%3E%3Cpath d='M120 176l22-22 20 20 36-36 22 22v38H120v-22z' fill='%236D5DFC' fill-opacity='.45'/%3E%3Ccircle cx='136' cy='156' r='10' fill='%236D5DFC' fill-opacity='.55'/%3E%3C/svg%3E";

function serializeSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return null;
  const record = err as Record<string, unknown>;
  return {
    message: String(record.message ?? ""),
    details: String(record.details ?? ""),
    hint: String(record.hint ?? ""),
    code: String(record.code ?? ""),
  };
}

function isUnauthorizedSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const code = String(record.code ?? "");
  const message = String(record.message ?? "").toLowerCase();
  return (
    code === "401" ||
    code === "42501" ||
    message.includes("unauthorized") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

export default function DbInstitutionDetailClient({ slug }: { slug: string }) {
  const [row, setRow] = useState<DbInstitutionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [mediaItems, setMediaItems] = useState<
    Array<{
      id: string;
      mediaType: "photo" | "video";
      url: string;
    }>
  >([]);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "photo" | "video">("all");
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [publicFeatureSections, setPublicFeatureSections] = useState<PublicFeatureGroupSection[]>([]);
  const [detailBranch, setDetailBranch] = useState<DetailBranch>("default");
  const [activeTab, setActiveTab] = useState<
    "overview" | "gallery" | "features" | "announcements"
  >("overview");
  const [institutionAnnouncements, setInstitutionAnnouncements] = useState<
    AnnouncementDetailItem[]
  >([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<AnnouncementDetailItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from("institutions")
        .select(
          "id, slug, institution_name, type, city, district, address, official_phone, website, subheading, about, logo, is_verified, source, working_hours_start, working_hours_end, institution_type:institution_types(name, category:institution_categories(name, slug))"
        )
        .eq("slug", slug)
        .maybeSingle();

      console.info("[institutions][detail][debug]", {
        routeSlug: slug,
        queriedColumn: "public.institutions.slug",
        queriedValue: slug,
      });

      if (cancelled) return;

      if (qErr) {
        console.error("[institutions][detail][db-query-error]", qErr);
        setRow(null);
        setError("Kurum kaydı yüklenirken bir hata oluştu.");
        setLoading(false);
        return;
      }

      const r = (data as DbInstitutionRow | null) ?? null;
      if (!r) {
        console.info("[institutions][detail][debug]", {
          matchedInstitutionId: null,
          matchedInstitutionSlug: null,
          matchedInstitutionSource: null,
          selectedBranch: "default",
        });
        setRow(null);
        setError("Kurum kaydı bulunamadı.");
        setLoading(false);
        return;
      }
      const nextBranch: DetailBranch = isMebInstitution(r.source)
        ? "meb"
        : r.source === "auto"
          ? "auto"
          : "default";
      setDetailBranch(nextBranch);
      console.info("[institutions][detail][debug]", {
        matchedInstitutionId: r.id,
        matchedInstitutionSlug: r.slug,
        matchedInstitutionSource: r.source,
        selectedBranch: nextBranch,
      });

      setRow(r);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  const handleAnchorTabClick = useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      sectionId: string,
      tab: "overview" | "gallery" | "features",
    ) => {
      event.preventDefault();
      setActiveTab(tab);
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  const handleAnnouncementsTabClick = useCallback(() => {
    setActiveTab("announcements");
  }, []);

  useEffect(() => {
    if (activeTab !== "announcements") return;
    if (!row?.id) return;
    if (announcementsLoaded) return;

    let cancelled = false;
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: qErr } = await supabase
        .from("announcements")
        .select(
          "id, title, content, announcement_image_url, link_url, created_at, institution:institutions(institution_name)"
        )
        .eq("institution_id", row.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (qErr) {
        console.error("[institution][announcements] load error", qErr);
        setAnnouncementsError("Duyurular yüklenemedi.");
        setInstitutionAnnouncements([]);
        setAnnouncementsLoading(false);
        setAnnouncementsLoaded(true);
        return;
      }

      const rows = (data ?? []) as Array<{
        id: string | number;
        title: string | null;
        content: string | null;
        announcement_image_url: string | null;
        link_url: string | null;
        created_at: string | null;
        institution:
          | { institution_name: string | null }
          | Array<{ institution_name: string | null }>
          | null;
      }>;

      const mapped: AnnouncementDetailItem[] = rows
        .map((r) => {
          const inst = Array.isArray(r.institution)
            ? r.institution[0] ?? null
            : r.institution ?? null;
          const title = String(r.title ?? "").trim();
          if (!title) return null;
          return {
            id: String(r.id),
            title,
            content: String(r.content ?? "").trim(),
            imageUrl: r.announcement_image_url
              ? String(r.announcement_image_url).trim() || null
              : null,
            createdAt: r.created_at ? String(r.created_at) : null,
            institutionName: String(inst?.institution_name ?? "").trim(),
            linkUrl: r.link_url ? String(r.link_url).trim() || null : null,
          } as AnnouncementDetailItem;
        })
        .filter((item): item is AnnouncementDetailItem => item !== null);

      console.info("[institution][announcements] loaded", {
        institutionId: row.id,
        count: mapped.length,
      });

      setInstitutionAnnouncements(mapped);
      setAnnouncementsLoading(false);
      setAnnouncementsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, row?.id, announcementsLoaded]);

  const formatAnnouncementDateTr = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const buildAnnouncementExcerpt = useCallback((text: string, maxLen: number) => {
    const t = String(text ?? "").trim().replace(/\s+/g, " ");
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }, []);

  const logoUrl = useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    const rawLogoPath = (row?.logo ?? "").trim();
    if (!rawLogoPath) {
      console.info("[institutions][detail][logo][raw]", rawLogoPath);
      console.info("[institutions][detail][logo][resolved]", "");
      return "";
    }

    const normalizedLogoPath = rawLogoPath.replace(/^\/+/, "");
    const resolvedUrl =
      supabase.storage.from("institution-logos").getPublicUrl(normalizedLogoPath).data.publicUrl || "";

    console.info("[institutions][detail][logo][raw]", rawLogoPath);
    console.info("[institutions][detail][logo][resolved]", resolvedUrl);
    return resolvedUrl;
  }, [row?.logo]);

  const name = (row?.institution_name ?? "Kurum").trim();
  const location = [row?.city, row?.district].filter(Boolean).join(", ") || "—";
  const institutionTypeRow = Array.isArray(row?.institution_type)
    ? row?.institution_type[0] ?? null
    : row?.institution_type ?? null;
  const categoryName = (institutionTypeRow?.category?.name ?? "").trim();
  const institutionCategorySlug = (institutionTypeRow?.category?.slug ?? "").trim();
  const subcategoryName = (institutionTypeRow?.name ?? row?.type ?? "").trim();
  const subheading = (row?.subheading ?? "").trim();
  const about = (row?.about ?? "").trim();
  const address = (row?.address ?? "").trim();
  const phone = (row?.official_phone ?? "").trim();
  const website = (row?.website ?? "").trim();
  const emptyText = "Henüz içerik girilmedi.";
  const workingHoursText =
    formatWorkingHoursRange(row?.working_hours_start, row?.working_hours_end) ?? emptyText;
  const hasLogo = Boolean((row?.logo ?? "").trim()) && Boolean(logoUrl) && !logoLoadFailed;
  const photoMediaItems = useMemo(
    () => mediaItems.filter((item) => item.mediaType === "photo"),
    [mediaItems]
  );
  const galleryImages = useMemo(
    () => photoMediaItems.map((item) => item.url),
    [photoMediaItems]
  );
  const filteredModalItems = useMemo(() => {
    if (galleryFilter === "photo") return mediaItems.filter((item) => item.mediaType === "photo");
    if (galleryFilter === "video") return mediaItems.filter((item) => item.mediaType === "video");
    return mediaItems;
  }, [galleryFilter, mediaItems]);
  const isViewerMode =
    activeViewerIndex !== null &&
    activeViewerIndex >= 0 &&
    activeViewerIndex < filteredModalItems.length;
  const activeViewerItem = isViewerMode ? filteredModalItems[activeViewerIndex] : null;
  const [academicLines, setAcademicLines] = useState<AcademicFeatureLine[]>([]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [row?.logo]);

  useEffect(() => {
    if (!row?.id) {
      setMediaItems([]);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data, error: mediaError } = await supabase
        .from("institution_media")
        .select("id, media_type, file_url, file_path, mime_type, file_name, sort_order, created_at")
        .eq("institution_id", Number(row.id))
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (mediaError) {
        console.error("[institutions][detail][gallery][query-error]", mediaError);
        setMediaItems([]);
        return;
      }

      const mediaRows = (data as InstitutionMediaImageRow[] | null) ?? [];
      const mappedItems = mediaRows
        .map((item) => {
          const normalizedMediaType = String(item.media_type ?? "").toLowerCase();
          const mediaType: "photo" | "video" =
            normalizedMediaType === "video" || (item.mime_type ?? "").toLowerCase().startsWith("video/")
              ? "video"
              : "photo";
          const rawUrl = (item.file_url ?? "").trim();
          if (rawUrl) {
            return {
              id: String(item.id),
              mediaType,
              url: rawUrl,
            };
          }

          const rawPath = (item.file_path ?? "").trim().replace(/^\/+/, "");
          if (!rawPath) return null;
          const resolvedUrl =
            supabase.storage.from("institution-media").getPublicUrl(rawPath).data.publicUrl || "";
          if (!resolvedUrl) return null;
          return {
            id: String(item.id),
            mediaType,
            url: resolvedUrl,
          };
        })
        .filter((item): item is { id: string; mediaType: "photo" | "video"; url: string } => Boolean(item?.url));

      setMediaItems(mappedItems);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id]);

  useEffect(() => {
    if (!row?.id) {
      setPublicFeatureSections([]);
      setAcademicLines([]);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const institutionId = Number(row.id);
    const selectedCategorySlug = institutionCategorySlug;

    (async () => {
      const [
        { data: groupsData, error: groupsError },
        { data: definitionsData, error: definitionsError },
        { data: choicesData, error: choicesError },
        { data: entriesData, error: entriesError },
      ] = await Promise.all([
        supabase
          .from("institution_feature_groups")
          .select("id, name, display_order, is_active, category_slug")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_definitions")
          .select("id, group_id, name, slug, input_type, unit, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true }),
        supabase
          .from("institution_feature_entries")
          .select("id, feature_definition_id, boolean_answer, text_answer, number_answer, selected_choice_id")
          .eq("institution_id", institutionId),
      ]);

      if (cancelled) return;

      if (groupsError || definitionsError || choicesError || entriesError) {
        if (
          isUnauthorizedSupabaseError(groupsError) ||
          isUnauthorizedSupabaseError(definitionsError) ||
          isUnauthorizedSupabaseError(choicesError) ||
          isUnauthorizedSupabaseError(entriesError)
        ) {
          setPublicFeatureSections([]);
          setAcademicLines([]);
          return;
        }

        console.warn("[institutions][detail][features][query-warning]", {
          groupsError: serializeSupabaseError(groupsError),
          definitionsError: serializeSupabaseError(definitionsError),
          choicesError: serializeSupabaseError(choicesError),
          entriesError: serializeSupabaseError(entriesError),
        });
        setPublicFeatureSections([]);
        setAcademicLines([]);
        return;
      }

      const entries = (entriesData as InstitutionFeatureEntryRow[] | null) ?? [];
      const entryIds = entries.map((entry) => entry.id);
      let entryChoices: InstitutionFeatureEntryChoiceRow[] = [];

      if (entryIds.length > 0) {
        const { data: entryChoicesData, error: entryChoicesError } = await supabase
          .from("institution_feature_entry_choices")
          .select("institution_feature_entry_id, choice_id")
          .in("institution_feature_entry_id", entryIds);

        if (!cancelled && entryChoicesError) {
          if (isUnauthorizedSupabaseError(entryChoicesError)) {
            setPublicFeatureSections([]);
            setAcademicLines([]);
            return;
          }
          console.warn(
            "[institutions][detail][features][entry-choices-warning]",
            serializeSupabaseError(entryChoicesError)
          );
        }
        entryChoices = (entryChoicesData as InstitutionFeatureEntryChoiceRow[] | null) ?? [];
      }

      if (cancelled) return;

      const groups = (groupsData as InstitutionFeatureGroupRow[] | null) ?? [];
      const definitions = (definitionsData as InstitutionFeatureDefinitionRow[] | null) ?? [];
      const choices = (choicesData as InstitutionFeatureChoiceRow[] | null) ?? [];

      const entriesByFeatureId = new Map<number, InstitutionFeatureEntryRow>();
      entries.forEach((entry) => entriesByFeatureId.set(entry.feature_definition_id, entry));

      const choicesByFeatureId = new Map<number, InstitutionFeatureChoiceRow[]>();
      choices.forEach((choice) => {
        const current = choicesByFeatureId.get(choice.feature_definition_id) ?? [];
        current.push(choice);
        choicesByFeatureId.set(choice.feature_definition_id, current);
      });

      const choiceNameById = new Map<number, string>();
      choices.forEach((choice) => {
        const label = (choice.name ?? "").trim();
        if (label) choiceNameById.set(choice.id, label);
      });

      const selectedChoiceIdsByEntryId = new Map<number, number[]>();
      entryChoices.forEach((rowChoice) => {
        const current = selectedChoiceIdsByEntryId.get(rowChoice.institution_feature_entry_id) ?? [];
        if (!current.includes(rowChoice.choice_id)) current.push(rowChoice.choice_id);
        selectedChoiceIdsByEntryId.set(rowChoice.institution_feature_entry_id, current);
      });

      const normalize = (v: string) =>
        v
          .toLowerCase()
          .replace(/ı/g, "i")
          .replace(/ğ/g, "g")
          .replace(/ş/g, "s")
          .replace(/ö/g, "o")
          .replace(/ü/g, "u")
          .replace(/ç/g, "c");

      const baslicaGroup = groups.find(
        (group) => (group.name ?? "").trim().toLocaleLowerCase("tr-TR") === "başlıca özellikler"
      );
      const akademikGroupFallback = groups.find(
        (group) => normalize((group.name ?? "").trim()) === normalize("Akademik İmkanlar")
      );
      const primaryStructuredGroup = baslicaGroup ?? akademikGroupFallback;

      const badgeGroups =
        selectedCategorySlug.length > 0
          ? groups.filter((group) => {
              const nameKey = (group.name ?? "").trim().toLocaleLowerCase("tr-TR");
              if (nameKey === "başlıca özellikler") return false;
              return (group.category_slug ?? "").trim() === selectedCategorySlug;
            })
          : [];

      const buildBadgesForGroup = (group: InstitutionFeatureGroupRow): string[] => {
        const groupFeatures = definitions
          .filter((feature) => feature.group_id === group.id)
          .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
        const badges: string[] = [];
        groupFeatures.forEach((feature) => {
          const entry = entriesByFeatureId.get(feature.id);
          if (!entry) return;

          if (feature.input_type === "boolean") {
            if (entry.boolean_answer === true) badges.push(feature.name);
            return;
          }

          if (feature.input_type === "single_select") {
            const selectedChoiceId = entry.selected_choice_id ?? null;
            if (!selectedChoiceId) return;
            const label = choiceNameById.get(selectedChoiceId);
            if (label) badges.push(label);
            return;
          }

          if (feature.input_type === "multi_select") {
            const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
            selectedIds.forEach((choiceId) => {
              const label = choiceNameById.get(choiceId);
              if (label) badges.push(label);
            });
            return;
          }

          if (feature.input_type === "text") {
            const value = (entry.text_answer ?? "").trim();
            if (!value) return;
            badges.push(`${feature.name}: ${value}`);
            return;
          }

          if (feature.input_type === "number") {
            if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return;
            const unit = (feature.unit ?? "").trim();
            badges.push(`${feature.name}: ${entry.number_answer}${unit ? ` ${unit}` : ""}`);
          }
        });
        return Array.from(new Set(badges));
      };

      const sections: PublicFeatureGroupSection[] = badgeGroups
        .map((group) => ({
          id: group.id,
          name: group.name,
          badges: buildBadgesForGroup(group),
        }))
        .filter((section) => section.badges.length > 0);

      setPublicFeatureSections(sections);

      const hasAny = (...needles: string[]) => (text: string) =>
        needles.some((needle) => text.includes(needle));
      const nextAcademicLines: AcademicFeatureLine[] = [];
      if (primaryStructuredGroup) {
        const academicFeatures = definitions.filter(
          (feature) => feature.group_id === primaryStructuredGroup.id
        );
        const extractFeatureValue = (feature: InstitutionFeatureDefinitionRow): string | string[] | null => {
          const entry = entriesByFeatureId.get(feature.id);
          if (!entry) return null;
          if (feature.input_type === "boolean") return entry.boolean_answer === true ? "Evet" : null;
          if (feature.input_type === "single_select") {
            const choiceId = entry.selected_choice_id ?? null;
            if (!choiceId) return null;
            return choiceNameById.get(choiceId) ?? null;
          }
          if (feature.input_type === "multi_select") {
            const selectedIds = selectedChoiceIdsByEntryId.get(entry.id) ?? [];
            const labels = selectedIds
              .map((id) => choiceNameById.get(id) ?? "")
              .filter((label) => Boolean(label));
            return labels.length > 0 ? labels : null;
          }
          if (feature.input_type === "number") {
            if (typeof entry.number_answer !== "number" || !Number.isFinite(entry.number_answer)) return null;
            return `${entry.number_answer}${feature.unit ? ` ${feature.unit}` : ""}`.trim();
          }
          if (feature.input_type === "text") {
            const value = (entry.text_answer ?? "").trim();
            return value || null;
          }
          return null;
        };
        const findBy = (matcher: (text: string) => boolean) =>
          academicFeatures.find((feature) => {
            const text = normalize(`${feature.slug ?? ""} ${feature.name ?? ""}`);
            return matcher(text);
          });
        const usedFeatureIds = new Set<number>();
        const pull = (label: string, matcher: (text: string) => boolean, isBadgeList?: boolean) => {
          const feature = findBy(matcher);
          if (!feature) return;
          const value = extractFeatureValue(feature);
          if (!value || (Array.isArray(value) && value.length === 0)) return;
          usedFeatureIds.add(feature.id);
          nextAcademicLines.push({ label, value, isBadgeList });
        };
        pull("Okul Türü", hasAny("okul durumu", "okul turu", "okul_turu", "kurum turu"));
        pull("Eğitim Türü", hasAny("egitim turu", "egitim_turu"));
        pull("Eğitim Dili", hasAny("egitim dili", "egitim_dili"));
        pull("Okul Saatleri", hasAny("okul saatleri", "okul_saatleri", "saat"));
        pull("Öğrenci Yaşı", hasAny("ogrenci yasi", "yas araligi", "yas", "ogrenci_yasi"));
        pull("Ortalama Sınıf Mevcudu", hasAny("ortalama sinif mevcudu", "sinif mevcudu", "mevcud"));
        pull("Hizmet Tipi", hasAny("hizmet tipi", "hizmet_tipi", "servis tipi", "service_type", "service type"));
        pull(
          "Aylık Ortalama Fiyat Aralığı",
          hasAny(
            "fiyat araligi",
            "fiyat_araligi",
            "aylik ortalama fiyat",
            "ortalama fiyat",
            "price_range",
            "monthly price"
          )
        );
        pull("Yabancı Diller", hasAny("yabanci diller", "yabanci dil"), true);

        const orderedRest = [...academicFeatures].sort(
          (a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999)
        );
        for (const feature of orderedRest) {
          if (usedFeatureIds.has(feature.id)) continue;
          const value = extractFeatureValue(feature);
          if (!value || (Array.isArray(value) && value.length === 0)) continue;
          const label = (feature.name ?? "").trim();
          if (!label) continue;
          usedFeatureIds.add(feature.id);
          nextAcademicLines.push({
            label,
            value,
            ...(feature.input_type === "multi_select" && Array.isArray(value) ? { isBadgeList: true } : {}),
          });
        }
      }
      setAcademicLines(nextAcademicLines);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id, institutionCategorySlug]);

  useEffect(() => {
    if (!isGalleryModalOpen) {
      setGalleryFilter("all");
      setActiveViewerIndex(null);
    }
  }, [isGalleryModalOpen]);

  useEffect(() => {
    if (activeViewerIndex === null) return;
    if (filteredModalItems.length === 0) {
      setActiveViewerIndex(null);
      return;
    }
    if (activeViewerIndex >= filteredModalItems.length) {
      setActiveViewerIndex(0);
    }
  }, [activeViewerIndex, filteredModalItems]);

  if (loading) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <h1 className="institution-name">Kurum Detay Sayfası</h1>
          <p>{error || "Kurum kaydı bulunamadı."}</p>
        </div>
      </div>
    );
  }

  if (detailBranch === "meb") {
    const subcategoryBadgeText =
      institutionTypeRow?.name?.trim() || row.type?.trim() || "";
    const categoryBadgeText =
      institutionTypeRow?.category?.name?.trim() || "";

    return (
      <div className="institution-detail-page institution-detail-page--meb">
        <div className="institution-detail-container">
          <nav className="institution-breadcrumb" aria-label="Breadcrumb">
            <div className="institution-breadcrumb-container">
              <Link href="/" className="institution-breadcrumb-link">
                Ana Sayfa
              </Link>
              <span className="institution-breadcrumb-separator"> &gt; </span>
              <Link href="/okullar" className="institution-breadcrumb-link">
                Kurumlar
              </Link>
              <span className="institution-breadcrumb-separator"> &gt; </span>
              <span className="institution-breadcrumb-current">{name}</span>
            </div>
          </nav>

          <Card className="institution-hero">
            <CardContent className="institution-hero-content">
              <div className="institution-hero-main">
                <div className="institution-logo-section">
                  <div className="institution-logo-wrapper">
                    <div className="institution-logo institution-logo--meb-fallback">
                      <GraduationCap size={56} />
                    </div>
                  </div>
                </div>

                <div className="institution-info">
                  <div className="institution-title-row">
                    <h1 className="institution-name">{name}</h1>
                  </div>

                  {categoryBadgeText || subcategoryBadgeText ? (
                    <div className="institution-meb-badges">
                      {categoryBadgeText ? (
                        <div className="institution-meb-type-badge institution-meb-type-badge--category">
                          {categoryBadgeText}
                        </div>
                      ) : null}
                      {subcategoryBadgeText ? (
                        <div className="institution-meb-type-badge institution-meb-type-badge--subcategory">
                          {subcategoryBadgeText}
                        </div>
                      ) : null}
                      <div className="institution-meb-approval-badge">
                        <CheckCircle2 size={16} aria-hidden />
                        Meb Onaylı
                      </div>
                    </div>
                  ) : null}

                  {row.city || row.district ? (
                    <div className="institution-meta">
                      <div className="institution-meta-item">
                        <MapPin size={18} />
                        <span>{[row.city, row.district].filter(Boolean).join(" / ")}</span>
                      </div>
                    </div>
                  ) : null}

                  {row.official_phone ? (
                    <div className="institution-meta">
                      <div className="institution-meta-item">
                        <Phone size={18} />
                        <a
                          href={`tel:${row.official_phone}`}
                          className="institution-contact-value institution-contact-link"
                        >
                          {row.official_phone}
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {row.address ? (
                    <div className="institution-meta">
                      <div className="institution-meta-item">
                        <MapPin size={18} />
                        <span>{row.address}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="institution-detail-page">
      <div className="institution-detail-container">
        <nav className="institution-breadcrumb" aria-label="Breadcrumb">
          <div className="institution-breadcrumb-container">
            <Link href="/" className="institution-breadcrumb-link">
              Ana Sayfa
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <Link href="/" className="institution-breadcrumb-link">
              Kurumlar
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <span className="institution-breadcrumb-current">{name}</span>
          </div>
        </nav>

        <Card className="institution-hero">
          <CardContent className="institution-hero-content">
            <div className="institution-hero-main">
              <div className="institution-logo-section">
                <div className="institution-logo-wrapper">
                  {hasLogo ? (
                    <Image
                      src={logoUrl}
                      alt={name}
                      width={160}
                      height={160}
                      className="institution-logo"
                      unoptimized
                      onError={() => setLogoLoadFailed(true)}
                    />
                  ) : (
                    <div className="institution-logo institution-logo-empty">
                      <p>{emptyText}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="institution-info">
                <div className="institution-title-row">
                  <h1 className="institution-name">{name}</h1>
                </div>
                {subheading ? <p className="institution-description">{subheading}</p> : null}
                <div className="institution-meta">
                  <div className="institution-meta-item">
                    <MapPin size={18} />
                    <span>{location}</span>
                  </div>
                  <div className="institution-meta-item">
                    <span className="institution-meta-badge institution-meta-badge--category">
                      {categoryName || "Okul"}
                    </span>
                  </div>
                  <div className="institution-meta-item">
                    <span className="institution-meta-badge institution-meta-badge--subcategory">
                      <GraduationCap size={16} />
                      {subcategoryName || emptyText}
                    </span>
                  </div>
                  {Boolean(row.is_verified) ? (
                    <div className="institution-meta-item institution-meta-verified institution-meta-badge institution-meta-badge--verified">
                      <CheckCircle2 size={18} />
                      <span>Onaylı Kurum</span>
                    </div>
                  ) : null}
                </div>
                <div className="institution-actions">
                  <ShareButton slug={String(row.slug ?? "").trim()} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="institution-tabs-sticky">
          <div className="institution-tabs-list">
            <a
              href="#overview"
              className={`institution-tab-item${activeTab === "overview" ? " institution-tab-active" : ""}`}
              onClick={(event) => handleAnchorTabClick(event, "overview", "overview")}
            >
              <BookOpen size={20} />
              <span>Genel Bakış</span>
            </a>
            <a
              href="#gallery"
              className={`institution-tab-item${activeTab === "gallery" ? " institution-tab-active" : ""}`}
              onClick={(event) => handleAnchorTabClick(event, "gallery", "gallery")}
            >
              <ImageIcon size={20} />
              <span>Galeri</span>
            </a>
            <a
              href="#features"
              className={`institution-tab-item${activeTab === "features" ? " institution-tab-active" : ""}`}
              onClick={(event) => handleAnchorTabClick(event, "features", "features")}
            >
              <Sparkles size={20} />
              <span>Kurum Özellikleri</span>
            </a>
            <button
              type="button"
              className={`institution-tab-item institution-tab-item--button${activeTab === "announcements" ? " institution-tab-active" : ""}`}
              onClick={handleAnnouncementsTabClick}
              aria-controls="announcements-tab"
            >
              <Megaphone size={20} />
              <span>Duyurular</span>
            </button>
          </div>
        </div>

        {activeTab !== "announcements" ? (
        <>
        <div className="institution-content-grid">
          <div className="institution-main-content">
            <section id="overview" className="institution-section">
              <h2 className="institution-section-title">Hakkımızda</h2>
              <Card className="institution-section-card">
                <CardContent>
                  <div className="institution-about-text">
                    {(about || emptyText).split("\n\n").map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="gallery" className="institution-section">
              <div className="institution-section-header">
                <h2 className="institution-section-title">Kurum Galerisi</h2>
                <button
                  type="button"
                  className="institution-section-link institution-gallery-view-all-btn"
                  onClick={() => setIsGalleryModalOpen(true)}
                >
                  tümünü gör
                </button>
              </div>
              <div className="institution-gallery-grid">
                <div
                  className="institution-gallery-item institution-gallery-main"
                  onClick={() => {
                    if (!galleryImages[0]) return;
                    setIsGalleryModalOpen(true);
                  }}
                >
                  {galleryImages[0] ? (
                    <Image
                      src={galleryImages[0]}
                      alt={`${name} galeri görseli`}
                      fill
                      className="institution-gallery-image"
                      sizes="(max-width: 768px) 100vw, 66vw"
                      unoptimized
                    />
                  ) : (
                    <div className="institution-gallery-fallback">
                      <div className="institution-gallery-fallback-icon">
                        <GraduationCap size={34} />
                      </div>
                      <p className="institution-gallery-fallback-text">{emptyText}</p>
                    </div>
                  )}
                </div>
                <div
                  className="institution-gallery-item"
                  onClick={() => {
                    if (!galleryImages[1]) return;
                    setIsGalleryModalOpen(true);
                  }}
                >
                  {galleryImages[1] ? (
                    <Image
                      src={galleryImages[1]}
                      alt={`${name} galeri görseli`}
                      fill
                      className="institution-gallery-image"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="institution-gallery-fallback">
                      <div className="institution-gallery-fallback-icon">
                        <GraduationCap size={30} />
                      </div>
                      <p className="institution-gallery-fallback-text">{emptyText}</p>
                    </div>
                  )}
                </div>
                <div
                  className="institution-gallery-item"
                  onClick={() => {
                    if (!galleryImages[2]) return;
                    setIsGalleryModalOpen(true);
                  }}
                >
                  {galleryImages[2] ? (
                    <Image
                      src={galleryImages[2]}
                      alt={`${name} galeri görseli`}
                      fill
                      className="institution-gallery-image"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="institution-gallery-fallback">
                      <div className="institution-gallery-fallback-icon">
                        <GraduationCap size={30} />
                      </div>
                      <p className="institution-gallery-fallback-text">{emptyText}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

          </div>

          <aside className="institution-sidebar">
            <div className="institution-sidebar-header">
              <Phone size={20} />
              <span>İletişim Bilgileri</span>
            </div>
            <div className="institution-sidebar-body">
              <div className="institution-map-preview">
                {hasLogo ? (
                  <Image
                    src={logoUrl}
                    alt={name}
                    fill
                    className="institution-map-image"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    unoptimized
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  <div className="institution-map-preview-empty">
                    <p>{emptyText}</p>
                  </div>
                )}
              </div>
              <div className="institution-contact-list">
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ADRES</div>
                    <div className="institution-contact-value">{address || emptyText}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">TELEFON</div>
                    <div className="institution-contact-value">{phone || emptyText}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Globe size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">WEB SİTESİ</div>
                    {website ? (
                      <a
                        href={website.startsWith("http") ? website : `https://${website}`}
                        className="institution-contact-value institution-contact-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {website}
                      </a>
                    ) : (
                      <div className="institution-contact-value">{emptyText}</div>
                    )}
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ÇALIŞMA SAATLERİ</div>
                    <div className="institution-contact-value">{workingHoursText}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section id="features" className="institution-section">
          <Card className="institution-section-card institution-features-card">
            <CardContent>
              <div className="institution-features-head">
                <h2 className="institution-section-title">Kurum Özellikleri</h2>
              </div>
              {publicFeatureSections.length > 0 || academicLines.length > 0 ? (
                <div className="institution-features-groups">
                  {academicLines.length > 0 ? (
                    <div className="institution-features-group">
                      <h3 className="institution-features-group-title">Başlıca Özellikler</h3>
                      <div className="institution-features-academic-list">
                        {academicLines.map((line, lineIdx) => (
                          <div key={`${line.label}-${lineIdx}`} className="institution-features-academic-row">
                            <span className="institution-features-academic-icon" aria-hidden>
                              <GitCommitVertical size={25} strokeWidth={2.2} />
                            </span>
                            <div className="institution-features-academic-content">
                              <span className="institution-features-academic-label">{line.label}</span>
                              <span className="institution-features-academic-value">
                                {Array.isArray(line.value) ? line.value.join(", ") : line.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {publicFeatureSections.map((section) => (
                    <div key={section.id} className="institution-features-group">
                      <h3 className="institution-features-group-title">{section.name}</h3>
                      <div className="institution-features-badges">
                        {section.badges.map((badge) => (
                          <span key={`${section.id}-${badge}`} className="institution-features-badge">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="institution-features-empty">{emptyText}</div>
              )}
            </CardContent>
          </Card>
        </section>
        </>
        ) : (
          <section
            id="announcements-tab"
            className="institution-section institution-announcements-tab"
            role="tabpanel"
            aria-label="Kurum duyuruları"
          >
            <Card className="institution-section-card institution-announcements-card">
              <CardContent>
                <div className="institution-features-head">
                  <h2 className="institution-section-title">Duyurular</h2>
                </div>
                {announcementsLoading ? (
                  <div className="institution-features-empty">
                    Duyurular yükleniyor...
                  </div>
                ) : announcementsError ? (
                  <div className="institution-features-empty">
                    {announcementsError}
                  </div>
                ) : institutionAnnouncements.length === 0 ? (
                  <div className="institution-features-empty">
                    Bu kuruma ait henüz duyuru bulunmuyor.
                  </div>
                ) : (
                  <div className="institution-announcements-list">
                    {institutionAnnouncements.map((item) => {
                      const trimmedLink = (item.linkUrl ?? "").trim();
                      const hasLink = trimmedLink.length > 0;
                      const absoluteLink = hasLink
                        ? /^https?:\/\//i.test(trimmedLink)
                          ? trimmedLink
                          : `https://${trimmedLink}`
                        : null;
                      const linkLabel = hasLink
                        ? trimmedLink.replace(/^https?:\/\//i, "").replace(/^www\./i, "")
                        : "";

                      return (
                        <article
                          key={item.id}
                          className="institution-announcement-item"
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveAnnouncement(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setActiveAnnouncement(item);
                            }
                          }}
                          aria-label={`${item.title} duyurusunu aç`}
                        >
                          <div
                            className={`institution-announcement-thumb${
                              item.imageUrl ? "" : " institution-announcement-thumb--empty"
                            }`}
                            aria-hidden
                          >
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt=""
                                fill
                                className="institution-announcement-thumb-image"
                                sizes="72px"
                                unoptimized
                              />
                            ) : (
                              <ImageOff
                                className="institution-announcement-thumb-icon"
                                size={28}
                                strokeWidth={1.25}
                              />
                            )}
                          </div>
                          <div className="institution-announcement-body">
                            {name ? (
                              <div className="institution-announcement-kicker">
                                {name.toLocaleUpperCase("tr-TR")}
                              </div>
                            ) : null}
                            <h3 className="institution-announcement-title">
                              {item.title}
                            </h3>
                            {item.content ? (
                              <p className="institution-announcement-desc">
                                {buildAnnouncementExcerpt(item.content, 220)}
                              </p>
                            ) : null}
                            <div className="institution-announcement-meta">
                              {item.createdAt ? (
                                <span className="institution-announcement-meta-item">
                                  <CalendarDays
                                    className="institution-announcement-meta-icon"
                                    size={14}
                                  />
                                  <span>
                                    {formatAnnouncementDateTr(item.createdAt)}
                                  </span>
                                </span>
                              ) : null}
                              {hasLink && absoluteLink ? (
                                <a
                                  href={absoluteLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="institution-announcement-meta-item institution-announcement-meta-link"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Globe
                                    className="institution-announcement-meta-icon"
                                    size={14}
                                  />
                                  <span>{linkLabel}</span>
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <AnnouncementDetailModal
          isOpen={Boolean(activeAnnouncement)}
          onClose={() => setActiveAnnouncement(null)}
          announcement={activeAnnouncement}
        />

        {isGalleryModalOpen ? (
          <div
            className="institution-gallery-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsGalleryModalOpen(false);
              }
            }}
          >
            <div className="institution-gallery-modal">
              <div className="institution-gallery-modal-header">
                <div>
                  <h3 className="institution-gallery-modal-title">Kurum Galerisi</h3>
                  <p className="institution-gallery-modal-subtitle">
                    Kurumunuza ait yüklenen medya içeriklerini görüntüleyin.
                  </p>
                </div>
                <div className="institution-gallery-modal-header-actions">
                  {isViewerMode ? (
                    <>
                      <button
                        type="button"
                        className="institution-gallery-viewer-back"
                        onClick={() => setActiveViewerIndex(null)}
                      >
                        <ArrowLeft size={16} />
                        Galeriye dön
                      </button>
                      <span className="institution-gallery-viewer-counter">
                        {activeViewerIndex + 1} / {filteredModalItems.length}
                      </span>
                    </>
                  ) : (
                    <div className="institution-gallery-modal-filters" role="tablist" aria-label="Galeri filtreleri">
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "all" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("all")}
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "photo" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("photo")}
                      >
                        Fotoğraf
                      </button>
                      <button
                        type="button"
                        className={`institution-gallery-modal-filter ${galleryFilter === "video" ? "institution-gallery-modal-filter--active" : ""}`}
                        onClick={() => setGalleryFilter("video")}
                      >
                        Video
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="institution-gallery-modal-close"
                    aria-label="Galeri modalını kapat"
                    onClick={() => setIsGalleryModalOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {filteredModalItems.length > 0 ? (
                isViewerMode && activeViewerItem ? (
                  <div className="institution-gallery-viewer">
                    <div className="institution-gallery-viewer-media-wrap">
                      {activeViewerItem.mediaType === "video" ? (
                        <video
                          className="institution-gallery-viewer-video"
                          src={activeViewerItem.url}
                          controls
                          autoPlay
                          preload="metadata"
                        />
                      ) : (
                        <div className="institution-gallery-viewer-image-wrap">
                          <Image
                            src={activeViewerItem.url}
                            alt={`${name} galeri görseli ${activeViewerIndex + 1}`}
                            fill
                            className="institution-gallery-viewer-image"
                            sizes="(max-width: 768px) 100vw, 90vw"
                            unoptimized
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        className="institution-gallery-viewer-nav institution-gallery-viewer-nav--prev"
                        aria-label="Önceki medya"
                        onClick={() =>
                          setActiveViewerIndex((prev) => {
                            if (prev === null || filteredModalItems.length === 0) return null;
                            return (prev - 1 + filteredModalItems.length) % filteredModalItems.length;
                          })
                        }
                      >
                        <ChevronLeft size={20} />
                      </button>

                      <button
                        type="button"
                        className="institution-gallery-viewer-nav institution-gallery-viewer-nav--next"
                        aria-label="Sonraki medya"
                        onClick={() =>
                          setActiveViewerIndex((prev) => {
                            if (prev === null || filteredModalItems.length === 0) return null;
                            return (prev + 1) % filteredModalItems.length;
                          })
                        }
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="institution-gallery-modal-grid">
                    {filteredModalItems.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`institution-gallery-modal-item institution-gallery-modal-item--${item.mediaType}`}
                        onClick={() => setActiveViewerIndex(index)}
                      >
                        {item.mediaType === "video" ? (
                          <>
                            <video
                              className="institution-gallery-modal-video"
                              src={item.url}
                              preload="metadata"
                              muted
                            />
                            <div className="institution-gallery-modal-video-overlay" aria-hidden>
                              <Play size={46}  />
                            </div>
                          </>
                        ) : (
                          <Image
                            src={item.url}
                            alt={`${name} galeri görseli ${index + 1}`}
                            fill
                            className="institution-gallery-image"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="institution-gallery-modal-empty">{emptyText}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

