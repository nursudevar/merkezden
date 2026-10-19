"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Shapes } from "lucide-react";
import { WorkingHoursTimePicker } from "@/app/panel/WorkingHoursTimePicker";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  formatWorkingHoursRange,
  inputHHMMToDbTimeOrNull,
  institutionTimeToInputHHMM,
} from "@/lib/institutionHelpers";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_FEATURES_CATEGORY_REQUIRED,
  INSTRUCTOR_FEATURES_LOAD_ERROR,
  INSTRUCTOR_FEATURES_SAVE_ERROR,
  INSTRUCTOR_FEATURES_SAVE_SUCCESS,
  buildInstructorDirectFeatureUpdatePayload,
  buildInstructorFeatureFormStateFromEntries,
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorFeatureDefinitionsBundleClient,
  fetchInstructorFeatureEntriesClient,
  fetchInstructorOwnedCategoryIdClient,
  getDisplayInstructorFeatureName,
  isInstructorBaslicaFeatureGroupName,
  isInstructorDersSeviyesiBooleanOption,
  isInstructorDersSeviyesiExcludedCategorySlug,
  isInstructorHizmetYeriBooleanOption,
  isInstructorPanelHiddenFeature,
  isInstructorPriceRangeFeature,
  projectInstructorDefinitionsWithGlobalEgitimDili,
  parseInstructorCategoryId,
  resolveInstructorCategoryDisplayName,
  resolveInstructorCategorySlug,
  resolveInstructorFeatureGroupsForActiveCategory,
  saveInstructorFeaturesClient,
  selectGlobalInstructorDersSeviyesiDefinitions,
  stripInstructorCategorySpecificFeatureFormValues,
  validateInstructorFeatureForm,
  type InstructorFeatureCategoryRow,
  type InstructorFeatureChoiceRow,
  type InstructorFeatureDefinitionRow,
  type InstructorFeatureEntryRow,
  type InstructorFeatureFormState,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
import {
  LESSON_DURATION_LABEL,
  findLessonDurationRangeDefinitions,
  formatLessonDurationDisplay,
  isLegacyLessonDurationMultiSelectFeature,
  isLessonDurationRangeNumberFeature,
} from "@/lib/instructorLessonDurationFeature";
import {
  STUDENT_AGE_RANGE_LABEL,
  findStudentAgeRangeDefinitions,
  formatStudentAgeDisplay,
  isInstructorPanelStudentAgeCategorySlug,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
  parseStudentAgeDecimalNumber,
} from "@/lib/studentAgeRangeFeature";
import { parsePriceInputToIntOrNull, formatInstitutionPriceRangeDisplay } from "@/lib/institutionPriceRangeFilter";
import {
  FEATURE_HIGHLIGHTS_REQUIRED_COUNT,
  FEATURE_HIGHLIGHT_PROFILE_KEYS,
  FEATURE_HIGHLIGHT_RANGE_KEYS,
  collectFilledFeatureHighlightCandidates,
  combinedHighlightCandidate,
  highlightRowToSelection,
  pruneFeatureHighlightSelections,
  toFeatureHighlightRpcItem,
  type FeatureHighlightRow,
  type FeatureHighlightSelection,
} from "@/lib/featureHighlights";
import {
  FEATURE_HIGHLIGHTS_ATOMIC_SAVE_ENABLED,
  FEATURE_HIGHLIGHTS_FOUR_REQUIRED,
  buildInstructorAtomicFeatureRows,
  saveInstructorFeaturesAtomicClient,
} from "@/lib/featureHighlightsAtomic";
import { fetchInstructorHighlightRowsClient } from "@/lib/featureHighlightsPublic";
import { SavingOverlay } from "@/components/SavingOverlay";
import { Button } from "@/components/ui";
import { FeatureHighlightsCard } from "@/components/features/FeatureHighlightsCard";
import {
  InstructorFeatureSelectionGroupList,
  type InstructorFeatureDefinitionForSelection,
  type InstructorFeatureSelectionGroup,
} from "./InstructorFeatureSelectionGroupList";
import {
  InstructorExtraBranchesSection,
  type InstructorExtraBranchesSectionHandle,
} from "./InstructorExtraBranchesSection";
import {
  collectInstructorExtraBranchProtectedDefinitionIds,
  loadInstructorExtraCategoryRelationsClient,
} from "@/lib/instructorExtraBranches";

type Props = {
  authUserId: string;
  instructorRow: InstructorProfileRow;
  onInstructorRowChange: (row: InstructorProfileRow) => void;
  splitLayout?: boolean;
  header?: ReactNode;
  leadingSlot?: ReactNode;
  extraBranchesRef?: Ref<InstructorExtraBranchesSectionHandle>;
  onExtraBranchSlotCountChange?: (count: number) => void;
};

const EMPTY_FORM: InstructorFeatureFormState = {
  booleanValues: {},
  textValues: {},
  numberValues: {},
  dateValues: {},
  singleSelectValues: {},
  multiSelectValues: {},
};

function priceFromDbToForm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return String(Math.floor(Number(value)));
}

const SUPPORTED_INPUT_TYPES = new Set([
  "text",
  "number",
  "date",
  "boolean",
  "multi_select",
  "single_select",
]);

const OZEL_EGITIM_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "ozel-egitim-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

const KISISEL_GELISIM_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "egitim-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

const YABANCI_DIL_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "yabanci-dil-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

const SPOR_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "hedef-fayda",
  "spor-turleri",
  "odeme-secenekleri",
] as const;

const SANAT_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "sanat-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

const MESLEKI_EGITIM_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "egitim-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

const KURS_SINAVA_HAZIRLIK_PANEL_GROUP_SLUG_SUFFIXES = [
  "egitim-ozellikleri",
  "ozel-ders-turleri",
  "hedef-fayda",
  "odeme-secenekleri",
] as const;

function normalizeYabanciDilPanelGroupName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sporInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = SPOR_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) => slug.endsWith(suffix));
  if (slugRank >= 0) return slugRank;

  const name = normalizeYabanciDilPanelGroupName(group.name);
  if (name === "egitim ozellikleri") return 0;
  if (name.includes("hedef") && name.includes("fayda")) return 1;
  if (name.includes("spor") && name.includes("tur") && !name.includes("tesis")) return 2;
  if (name === "odeme secenekleri") return 3;
  return SPOR_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function sanatInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = SANAT_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) => slug.endsWith(suffix));
  if (slugRank >= 0) return slugRank;

  const name = normalizeYabanciDilPanelGroupName(group.name);
  if (name === "egitim ozellikleri") return 0;
  if (name.includes("sanat") && name.includes("tur")) return 1;
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return SANAT_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function kursSinavaHazirlikInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = KURS_SINAVA_HAZIRLIK_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) =>
    slug.endsWith(suffix),
  );
  if (slugRank >= 0) return slugRank;

  const name = normalizeYabanciDilPanelGroupName(group.name);
  if (name === "egitim ozellikleri") return 0;
  if (name === "ozel ders turleri" || name === "kurs turleri") return 1;
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return KURS_SINAVA_HAZIRLIK_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function meslekiEgitimInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = MESLEKI_EGITIM_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) =>
    slug.endsWith(suffix),
  );
  if (slugRank >= 0) return slugRank;

  const name = normalizeYabanciDilPanelGroupName(group.name);
  if (name === "egitim ozellikleri") return 0;
  if (
    name === "mesleki egitim turleri" ||
    name === "egitim turleri" ||
    (name.includes("egitim") && name.includes("tur") && !name.includes("ozellik") && !name.includes("seviye"))
  ) {
    return 1;
  }
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return MESLEKI_EGITIM_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function yabanciDilInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = YABANCI_DIL_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) =>
    slug.endsWith(suffix),
  );
  if (slugRank >= 0) return slugRank;

  const name = normalizeYabanciDilPanelGroupName(group.name);
  if (name === "egitim ozellikleri") return 0;
  if (name === "yabanci dil turleri" || (name.includes("yabanci") && name.includes("dil") && name.includes("tur"))) {
    return 1;
  }
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return YABANCI_DIL_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function kisiselGelisimInstructorPanelGroupRank(group: {
  name: string;
  slug?: string | null;
}): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = KISISEL_GELISIM_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) =>
    slug.endsWith(suffix),
  );
  if (slugRank >= 0) return slugRank;

  const name = String(group.name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name === "egitim ozellikleri") return 0;
  if (name === "egitim turleri" || name.endsWith(" egitim turleri")) return 1;
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return KISISEL_GELISIM_PANEL_GROUP_SLUG_SUFFIXES.length;
}

function ozelEgitimInstructorPanelGroupRank(group: { name: string; slug?: string | null }): number {
  const slug = String(group.slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const slugRank = OZEL_EGITIM_PANEL_GROUP_SLUG_SUFFIXES.findIndex((suffix) => slug.endsWith(suffix));
  if (slugRank >= 0) return slugRank;

  const name = String(group.name ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name === "egitim ozellikleri") return 0;
  if (name === "ozel egitim turleri") return 1;
  if (name.includes("hedef") && name.includes("fayda")) return 2;
  if (name === "odeme secenekleri") return 3;
  return OZEL_EGITIM_PANEL_GROUP_SLUG_SUFFIXES.length;
}

export function InstructorFeaturesTab({
  authUserId,
  instructorRow,
  onInstructorRowChange,
  splitLayout = false,
  header = null,
  leadingSlot = null,
  extraBranchesRef = null,
  onExtraBranchSlotCountChange,
}: Props) {
  const instructorId = Number(instructorRow.id);
  const hasValidInstructorId = Number.isFinite(instructorId) && instructorId > 0;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [saveToastNonce, setSaveToastNonce] = useState(0);
  const [studentAgeRangeError, setStudentAgeRangeError] = useState<string | null>(null);
  const [lessonDurationPanelError, setLessonDurationPanelError] = useState<string | null>(null);

  const [categories, setCategories] = useState<InstructorFeatureCategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [openInstructorCategoryPicker, setOpenInstructorCategoryPicker] = useState(false);
  const [featureGroups, setFeatureGroups] = useState<InstructorFeatureGroupRow[]>([]);
  const [featureDefinitions, setFeatureDefinitions] = useState<InstructorFeatureDefinitionRow[]>([]);
  const [featureChoices, setFeatureChoices] = useState<InstructorFeatureChoiceRow[]>([]);
  const [featureEntries, setFeatureEntries] = useState<InstructorFeatureEntryRow[]>([]);

  const [form, setForm] = useState<InstructorFeatureFormState>(EMPTY_FORM);
  const [minFiyat, setMinFiyat] = useState("");
  const [maxFiyat, setMaxFiyat] = useState("");
  const [availableHourStart, setAvailableHourStart] = useState("");
  const [availableHourEnd, setAvailableHourEnd] = useState("");
  const [openInstructorSelectId, setOpenInstructorSelectId] = useState<number | null>(null);
  const [blockedExtraBranchCategoryName, setBlockedExtraBranchCategoryName] = useState<string | null>(
    null,
  );
  const [categoryChangeCheckError, setCategoryChangeCheckError] = useState<string | null>(null);
  const categoryChangeRequestRef = useRef(0);
  const [highlightSelections, setHighlightSelections] = useState<FeatureHighlightSelection[]>([]);
  const [highlightRows, setHighlightRows] = useState<FeatureHighlightRow[]>([]);
  const [highlightsHydrated, setHighlightsHydrated] = useState(false);
  const [highlightWarning, setHighlightWarning] = useState<string | null>(null);

  useEffect(() => {
    setMinFiyat(priceFromDbToForm(instructorRow.min_fiyat));
    setMaxFiyat(priceFromDbToForm(instructorRow.max_fiyat));
    setAvailableHourStart(institutionTimeToInputHHMM(instructorRow.working_hours_start));
    setAvailableHourEnd(institutionTimeToInputHHMM(instructorRow.working_hours_end));
  }, [
    instructorRow.id,
    instructorRow.min_fiyat,
    instructorRow.max_fiyat,
    instructorRow.working_hours_start,
    instructorRow.working_hours_end,
  ]);

  const applyFormFromEntries = useCallback(
    (
      definitions: InstructorFeatureDefinitionRow[],
      entries: InstructorFeatureEntryRow[],
      entryChoices: { instructor_feature_entry_id: number; choice_id: number }[],
    ) => {
      setForm(buildInstructorFeatureFormStateFromEntries(definitions, entries, entryChoices));
    },
    [],
  );

  const flashSaveMessage = (message: string) => {
    setSaveToastNonce((n) => n + 1);
    setSaveToastMessage(message);
  };

  useEffect(() => {
    if (!saveToastMessage) return;
    const timer = window.setTimeout(() => setSaveToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [saveToastMessage, saveToastNonce]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (!hasValidInstructorId) {
      setFeatureEntries([]);
      setForm(EMPTY_FORM);
      setHighlightRows([]);
      setHighlightSelections([]);
      setHighlightsHydrated(true);
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const [{ categories: cats, error: catError }, bundle, entriesResult, ownedCategory] =
      await Promise.all([
        fetchInstructorFeatureCategoriesClient(supabase),
        fetchInstructorFeatureDefinitionsBundleClient(supabase),
        fetchInstructorFeatureEntriesClient(authUserId, instructorId, supabase),
        fetchInstructorOwnedCategoryIdClient(authUserId, instructorId, supabase),
      ]);

    if (catError || bundle.error || entriesResult.error || ownedCategory.error) {
      setLoadError(
        catError ??
          bundle.error ??
          entriesResult.error ??
          ownedCategory.error ??
          INSTRUCTOR_FEATURES_LOAD_ERROR,
      );
      setLoading(false);
      return;
    }

    setCategories(cats);
    setFeatureGroups(bundle.groups);
    setFeatureDefinitions(bundle.definitions);
    setFeatureChoices(bundle.choices);
    setFeatureEntries(entriesResult.entries);

    const loadedCategoryId = ownedCategory.categoryId;
    setCategoryId(loadedCategoryId != null ? String(loadedCategoryId) : "");

    const previousCategoryId = parseInstructorCategoryId(instructorRow.category_id);
    if (previousCategoryId !== loadedCategoryId) {
      onInstructorRowChange({ ...instructorRow, category_id: loadedCategoryId });
    }

    applyFormFromEntries(
      bundle.definitions,
      entriesResult.entries,
      entriesResult.entryChoices,
    );
    const loadedHighlights = await fetchInstructorHighlightRowsClient(instructorId, supabase);
    setHighlightRows(loadedHighlights);
    setHighlightsHydrated(false);
    setHighlightWarning(null);
    setLoading(false);
  }, [applyFormFromEntries, authUserId, hasValidInstructorId, instructorId, onInstructorRowChange]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".egitmen-panel-features-single-select-dropdown")) {
        setOpenInstructorSelectId(null);
        setOpenInstructorCategoryPicker(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedCategoryNumericId = parseInstructorCategoryId(categoryId);

  const instructorCategorySlug = useMemo(() => {
    return resolveInstructorCategorySlug(selectedCategoryNumericId, categories);
  }, [categories, selectedCategoryNumericId]);

  const categoryDisplayName = useMemo(() => {
    return resolveInstructorCategoryDisplayName(selectedCategoryNumericId, categories);
  }, [categories, selectedCategoryNumericId]);

  const groupsWithFeatures = useMemo((): InstructorFeatureSelectionGroup[] => {
    const showStudentAge = isInstructorPanelStudentAgeCategorySlug(instructorCategorySlug);
    const showDersSeviyesi = !isInstructorDersSeviyesiExcludedCategorySlug(instructorCategorySlug);
    const visibleGroups = resolveInstructorFeatureGroupsForActiveCategory(
      featureGroups,
      instructorCategorySlug,
    );
    const definitionsForPanel = projectInstructorDefinitionsWithGlobalEgitimDili(
      featureDefinitions,
      visibleGroups,
      featureGroups,
    );

    return visibleGroups
      .map((group) => {
        const sourceFeatures = definitionsForPanel
          .filter((f) => f.group_id === group.id)
          .filter((f) => SUPPORTED_INPUT_TYPES.has(f.input_type))
          .filter((f) => !isInstructorPanelHiddenFeature(f))
          .filter((f) => !isInstructorPriceRangeFeature(f))
          .filter((f) => !isLegacyStudentAgeMultiSelectFeature(f))
          .filter((f) => !isLegacyLessonDurationMultiSelectFeature(f))
          .filter((f) => showStudentAge || !isStudentAgeRangeNumberFeature(f))
          .filter((f) => showDersSeviyesi || !isInstructorDersSeviyesiBooleanOption(f))
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

        if (isInstructorBaslicaFeatureGroupName(group.name)) {
          const presentIds = new Set(sourceFeatures.map((feature) => feature.id));
          const missingHizmetYeri = featureDefinitions
            .filter((feature) => isInstructorHizmetYeriBooleanOption(feature))
            .filter((feature) => !presentIds.has(feature.id))
            .filter((feature) => SUPPORTED_INPUT_TYPES.has(feature.input_type))
            .filter((feature) => !isInstructorPanelHiddenFeature(feature))
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          for (const feature of missingHizmetYeri) {
            const order = feature.display_order ?? Number.MAX_SAFE_INTEGER;
            const insertAt = sourceFeatures.findIndex(
              (current) => (current.display_order ?? Number.MAX_SAFE_INTEGER) > order,
            );
            if (insertAt === -1) sourceFeatures.push(feature);
            else sourceFeatures.splice(insertAt, 0, feature);
          }

          const missingDersSeviyesi = showDersSeviyesi
            ? selectGlobalInstructorDersSeviyesiDefinitions(featureDefinitions, featureGroups)
                .filter((feature) => !presentIds.has(feature.id))
                .filter((feature) => SUPPORTED_INPUT_TYPES.has(feature.input_type))
                .filter((feature) => !isInstructorPanelHiddenFeature(feature))
            : [];
          for (const feature of missingDersSeviyesi) {
            const order = feature.display_order ?? Number.MAX_SAFE_INTEGER;
            const insertAt = sourceFeatures.findIndex(
              (current) => (current.display_order ?? Number.MAX_SAFE_INTEGER) > order,
            );
            if (insertAt === -1) sourceFeatures.push(feature);
            else sourceFeatures.splice(insertAt, 0, feature);
          }

          const globalBaslicaGroupIds = new Set(
            featureGroups
              .filter(
                (group) =>
                  isInstructorBaslicaFeatureGroupName(group.name) &&
                  !String(group.category_slug ?? "").trim(),
              )
              .map((group) => group.id),
          );
          const missingLessonDuration = featureDefinitions
            .filter((feature) => isLessonDurationRangeNumberFeature(feature))
            .filter(
              (feature) =>
                globalBaslicaGroupIds.size === 0 || globalBaslicaGroupIds.has(feature.group_id),
            )
            .filter((feature) => !presentIds.has(feature.id))
            .filter((feature) => SUPPORTED_INPUT_TYPES.has(feature.input_type))
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          for (const feature of missingLessonDuration) {
            const order = feature.display_order ?? Number.MAX_SAFE_INTEGER;
            const insertAt = sourceFeatures.findIndex(
              (current) => (current.display_order ?? Number.MAX_SAFE_INTEGER) > order,
            );
            if (insertAt === -1) sourceFeatures.push(feature);
            else sourceFeatures.splice(insertAt, 0, feature);
          }
        }

        const features: InstructorFeatureDefinitionForSelection[] = sourceFeatures.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug ?? null,
          input_type: f.input_type,
          help_text: f.help_text,
          placeholder: f.placeholder,
          unit: f.unit,
        }));
        return {
          group: {
            id: group.id,
            name: group.name,
            slug: group.slug,
            category_slug: group.category_slug,
            display_order: group.display_order,
          },
          features,
        };
      })
      .filter(
        (item) =>
          item.features.length > 0 || isInstructorBaslicaFeatureGroupName(item.group.name),
      )
      .sort(
        (a, b) =>
          (a.group.display_order ?? Number.MAX_SAFE_INTEGER) -
          (b.group.display_order ?? Number.MAX_SAFE_INTEGER),
      );
  }, [featureDefinitions, featureGroups, instructorCategorySlug]);

  // Üst alan: global gruplar + category-specific Başlıca (Patili Başlıca kategori seçiminin hemen altında).
  // Alt alan: diğer category-specific gruplar (Fiziki İmkanlar, Ödeme Seçenekleri, …).
  const upperGroups = groupsWithFeatures.filter(({ group }) => {
    const hasCategorySlug = Boolean((group.category_slug ?? "").trim());
    if (!hasCategorySlug) return true;
    return isInstructorBaslicaFeatureGroupName(group.name);
  });
  const lowerGroupsUnsorted = groupsWithFeatures.filter(({ group }) => {
    const hasCategorySlug = Boolean((group.category_slug ?? "").trim());
    if (!hasCategorySlug) return false;
    return !isInstructorBaslicaFeatureGroupName(group.name);
  });
  const lowerCategorySlug = String(instructorCategorySlug ?? "").trim().toLocaleLowerCase("tr-TR");
  const lowerGroups =
    lowerCategorySlug === "ozel-egitim"
      ? [...lowerGroupsUnsorted].sort(
          (a, b) =>
            ozelEgitimInstructorPanelGroupRank(a.group) - ozelEgitimInstructorPanelGroupRank(b.group),
        )
      : lowerCategorySlug === "kisisel-gelisim"
        ? [...lowerGroupsUnsorted].sort(
            (a, b) =>
              kisiselGelisimInstructorPanelGroupRank(a.group) -
              kisiselGelisimInstructorPanelGroupRank(b.group),
          )
        : lowerCategorySlug === "yabanci-dil"
          ? [...lowerGroupsUnsorted].sort(
              (a, b) =>
                yabanciDilInstructorPanelGroupRank(a.group) -
                yabanciDilInstructorPanelGroupRank(b.group),
            )
          : lowerCategorySlug === "spor"
            ? [...lowerGroupsUnsorted].sort(
                (a, b) =>
                  sporInstructorPanelGroupRank(a.group) - sporInstructorPanelGroupRank(b.group),
              )
            : lowerCategorySlug === "sanat"
              ? [...lowerGroupsUnsorted].sort(
                  (a, b) =>
                    sanatInstructorPanelGroupRank(a.group) - sanatInstructorPanelGroupRank(b.group),
                )
              : lowerCategorySlug === "mesleki-egitim"
                ? [...lowerGroupsUnsorted].sort(
                    (a, b) =>
                      meslekiEgitimInstructorPanelGroupRank(a.group) -
                      meslekiEgitimInstructorPanelGroupRank(b.group),
                  )
                : lowerCategorySlug === "kurs-sinava-hazirlik"
                  ? [...lowerGroupsUnsorted].sort(
                      (a, b) =>
                        kursSinavaHazirlikInstructorPanelGroupRank(a.group) -
                        kursSinavaHazirlikInstructorPanelGroupRank(b.group),
                    )
                  : lowerGroupsUnsorted;

  const featureIdsToSave = useMemo(() => {
    const ids = new Set<number>();
    for (const { features } of groupsWithFeatures) {
      for (const f of features) ids.add(f.id);
    }
    return Array.from(ids);
  }, [groupsWithFeatures]);

  const highlightCandidates = useMemo(() => {
    const skip = (feature: { id: number; slug?: string | null; input_type: string }) =>
      isStudentAgeRangeNumberFeature(feature) || isLessonDurationRangeNumberFeature(feature);
    const candidates = collectFilledFeatureHighlightCandidates({
      groups: groupsWithFeatures,
      form,
      choices: featureChoices,
      displayName: getDisplayInstructorFeatureName,
      skipFeature: skip,
    });
    const groupName =
      groupsWithFeatures.find((item) => isInstructorBaslicaFeatureGroupName(item.group.name))?.group
        .name ?? "Başlıca Özellikler";
    const ageDefs = findStudentAgeRangeDefinitions(featureDefinitions);
    if (isInstructorPanelStudentAgeCategorySlug(instructorCategorySlug) && ageDefs.min && ageDefs.max) {
      const min = parseStudentAgeDecimalNumber(form.numberValues[ageDefs.min.id]);
      const max = parseStudentAgeDecimalNumber(form.numberValues[ageDefs.max.id]);
      if (min != null && max != null) {
        candidates.push(
          combinedHighlightCandidate({
            kind: "range",
            range_key: FEATURE_HIGHLIGHT_RANGE_KEYS.studentAge,
            label: STUDENT_AGE_RANGE_LABEL,
            groupName,
            valueLabel: formatStudentAgeDisplay(min, max),
          }),
        );
      }
    }
    const durationDefs = findLessonDurationRangeDefinitions(featureDefinitions);
    const durationIds = new Set(featureIdsToSave);
    if (
      (durationDefs.min && durationIds.has(durationDefs.min.id)) ||
      (durationDefs.max && durationIds.has(durationDefs.max.id))
    ) {
      const minRaw = durationDefs.min
        ? Number(String(form.numberValues[durationDefs.min.id] ?? "").trim())
        : Number.NaN;
      const maxRaw = durationDefs.max
        ? Number(String(form.numberValues[durationDefs.max.id] ?? "").trim())
        : Number.NaN;
      const min = Number.isFinite(minRaw) ? minRaw : null;
      const max = Number.isFinite(maxRaw) ? maxRaw : null;
      const durationValue = formatLessonDurationDisplay(min, max);
      if (durationValue) {
        candidates.push(
          combinedHighlightCandidate({
            kind: "range",
            range_key: FEATURE_HIGHLIGHT_RANGE_KEYS.lessonDuration,
            label: LESSON_DURATION_LABEL,
            groupName,
            valueLabel: durationValue,
          }),
        );
      }
    }
    const hoursValue = formatWorkingHoursRange(
      inputHHMMToDbTimeOrNull(availableHourStart),
      inputHHMMToDbTimeOrNull(availableHourEnd),
    );
    if (hoursValue) {
      candidates.push(
        combinedHighlightCandidate({
          kind: "profile",
          profile_key: FEATURE_HIGHLIGHT_PROFILE_KEYS.workingHours,
          label: "Müsait Saat Aralığı",
          groupName,
          valueLabel: hoursValue,
        }),
      );
    }
    const priceValue = formatInstitutionPriceRangeDisplay(
      parsePriceInputToIntOrNull(minFiyat),
      parsePriceInputToIntOrNull(maxFiyat),
    );
    if (priceValue) {
      candidates.push(
        combinedHighlightCandidate({
          kind: "profile",
          profile_key: FEATURE_HIGHLIGHT_PROFILE_KEYS.priceRange,
          label: "Fiyat Aralığı",
          groupName,
          valueLabel: priceValue,
        }),
      );
    }
    return candidates;
  }, [
    availableHourEnd,
    availableHourStart,
    featureChoices,
    featureDefinitions,
    featureIdsToSave,
    form,
    groupsWithFeatures,
    instructorCategorySlug,
    maxFiyat,
    minFiyat,
  ]);

  useEffect(() => {
    if (loading || highlightsHydrated) return;
    const mapped = highlightRows
      .map((row) => highlightRowToSelection(row, highlightCandidates))
      .filter((item): item is FeatureHighlightSelection => item != null);
    setHighlightSelections(mapped);
    setHighlightsHydrated(true);
  }, [highlightCandidates, highlightRows, highlightsHydrated, loading]);

  useEffect(() => {
    if (!highlightsHydrated) return;
    const { next, removed } = pruneFeatureHighlightSelections(
      highlightSelections,
      highlightCandidates,
    );
    if (removed.length === 0 && next.length === highlightSelections.length) return;
    setHighlightSelections(next);
    if (removed.length > 0) {
      setHighlightWarning(
        `${removed.map((item) => `“${item.label}”`).join(", ")} öne çıkan özelliklerden kaldırıldı, çünkü formda artık seçili değil.`,
      );
    }
  }, [highlightCandidates, highlightSelections, highlightsHydrated]);

  /** Gizli kategorilerde Öğrenci Yaşı entry'lerini silme — yalnızca UI görünürlüğü değişir. */
  const protectedStudentAgeDefinitionIds = useMemo(() => {
    const ids: number[] = [];
    if (!isInstructorPanelStudentAgeCategorySlug(instructorCategorySlug)) {
      const ageDefs = findStudentAgeRangeDefinitions(featureDefinitions);
      if (ageDefs.min) ids.push(ageDefs.min.id);
      if (ageDefs.max) ids.push(ageDefs.max.id);
    }
    return ids;
  }, [featureDefinitions, instructorCategorySlug]);

  const setBoolean = (updater: React.SetStateAction<Record<number, boolean>>) => {
    setForm((prev) => ({
      ...prev,
      booleanValues: typeof updater === "function" ? updater(prev.booleanValues) : updater,
    }));
  };
  const setText = (updater: React.SetStateAction<Record<number, string>>) => {
    setForm((prev) => ({
      ...prev,
      textValues: typeof updater === "function" ? updater(prev.textValues) : updater,
    }));
  };
  const setNumber = (updater: React.SetStateAction<Record<number, string>>) => {
    setForm((prev) => ({
      ...prev,
      numberValues: typeof updater === "function" ? updater(prev.numberValues) : updater,
    }));
  };
  const setDate = (updater: React.SetStateAction<Record<number, string>>) => {
    setForm((prev) => ({
      ...prev,
      dateValues: typeof updater === "function" ? updater(prev.dateValues) : updater,
    }));
  };
  const setSingle = (updater: React.SetStateAction<Record<number, string>>) => {
    setForm((prev) => ({
      ...prev,
      singleSelectValues: typeof updater === "function" ? updater(prev.singleSelectValues) : updater,
    }));
  };
  const setMulti = (updater: React.SetStateAction<Record<number, string[]>>) => {
    setForm((prev) => ({
      ...prev,
      multiSelectValues: typeof updater === "function" ? updater(prev.multiSelectValues) : updater,
    }));
  };

  const handleSave = async () => {
    if (!hasValidInstructorId) {
      flashSaveMessage(INSTRUCTOR_FEATURES_LOAD_ERROR);
      return;
    }

    const minFiyatDigits = String(minFiyat ?? "").replace(/[^\d]/g, "");
    const maxFiyatDigits = String(maxFiyat ?? "").replace(/[^\d]/g, "");
    if (String(minFiyat ?? "").trim() && !minFiyatDigits) {
      flashSaveMessage("Aylık fiyat minimum değeri geçerli bir sayı olmalıdır.");
      return;
    }
    if (String(maxFiyat ?? "").trim() && !maxFiyatDigits) {
      flashSaveMessage("Aylık fiyat maksimum değeri geçerli bir sayı olmalıdır.");
      return;
    }
    const minFiyatValue = parsePriceInputToIntOrNull(minFiyat);
    const maxFiyatValue = parsePriceInputToIntOrNull(maxFiyat);
    if (minFiyatValue != null && maxFiyatValue != null && maxFiyatValue < minFiyatValue) {
      flashSaveMessage("Maksimum fiyat, minimum fiyattan küçük olamaz.");
      return;
    }
    if (lessonDurationPanelError) {
      flashSaveMessage(lessonDurationPanelError);
      return;
    }

    setSaving(true);
    setSaveToastMessage(null);

    const validationError = validateInstructorFeatureForm(featureDefinitions, form, featureIdsToSave);
    if (validationError) {
      setStudentAgeRangeError(
        validationError.includes("yaş") || validationError.includes("Yaş") ? validationError : null,
      );
      flashSaveMessage(validationError);
      setSaving(false);
      return;
    }
    setStudentAgeRangeError(null);

    if (FEATURE_HIGHLIGHTS_ATOMIC_SAVE_ENABLED) {
      if (highlightSelections.length !== FEATURE_HIGHLIGHTS_REQUIRED_COUNT) {
        flashSaveMessage(FEATURE_HIGHLIGHTS_FOUR_REQUIRED);
        setSaving(false);
        return;
      }
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const categoryIdToSave = parseInstructorCategoryId(categoryId);
      if (categoryIdToSave == null) {
        flashSaveMessage(INSTRUCTOR_FEATURES_CATEGORY_REQUIRED);
        setSaving(false);
        return;
      }

      if (FEATURE_HIGHLIGHTS_ATOMIC_SAVE_ENABLED) {
        const directPatch = buildInstructorDirectFeatureUpdatePayload(
          featureDefinitions,
          featureChoices,
          form,
          featureIdsToSave,
        );
        const { error: atomicError } = await saveInstructorFeaturesAtomicClient(
          {
            instructor_id: instructorId,
            category_id: categoryIdToSave,
            lesson_type: directPatch.lesson_type ?? instructorRow.lesson_type ?? null,
            service_type: directPatch.service_type ?? instructorRow.service_type ?? null,
            min_fiyat: minFiyatValue,
            max_fiyat: maxFiyatValue,
            working_hours_start: inputHHMMToDbTimeOrNull(availableHourStart),
            working_hours_end: inputHHMMToDbTimeOrNull(availableHourEnd),
            features: buildInstructorAtomicFeatureRows(
              featureDefinitions,
              new Set(featureIdsToSave),
              form,
            ),
            highlights: highlightSelections.map((item, index) =>
              toFeatureHighlightRpcItem(item, index + 1),
            ),
          },
          supabase,
        );
        if (atomicError) {
          flashSaveMessage(atomicError);
          return;
        }
      } else {
      let extraBranchProtectedDefinitionIds: number[] = [];
      try {
        extraBranchProtectedDefinitionIds = await collectInstructorExtraBranchProtectedDefinitionIds(
          supabase,
          instructorId,
        );
      } catch (error) {
        console.error("Instructor extra-branch protection load error:", error);
        flashSaveMessage(INSTRUCTOR_FEATURES_SAVE_ERROR);
        setSaving(false);
        return;
      }

      const { error: saveError } = await saveInstructorFeaturesClient(
        {
          authUid: authUserId,
          instructorId,
          definitions: featureDefinitions,
          groups: featureGroups,
          choices: featureChoices,
          entries: featureEntries,
          form,
          featureIdsToSave,
          categoryIdToSave,
          protectedDefinitionIds: Array.from(
            new Set([...protectedStudentAgeDefinitionIds, ...extraBranchProtectedDefinitionIds]),
          ),
        },
        supabase,
      );

      if (saveError) {
        flashSaveMessage(saveError);
        return;
      }
      }

      const availableHourStartValue = inputHHMMToDbTimeOrNull(availableHourStart);
      const availableHourEndValue = inputHHMMToDbTimeOrNull(availableHourEnd);

      if (!FEATURE_HIGHLIGHTS_ATOMIC_SAVE_ENABLED) {
      const { error: priceError } = await supabase
        .from("instructors")
        .update({
          min_fiyat: minFiyatValue,
          max_fiyat: maxFiyatValue,
          working_hours_start: availableHourStartValue,
          working_hours_end: availableHourEndValue,
        })
        .eq("id", instructorId)
        .eq("owner_auth_id", authUserId);

      if (priceError) {
        flashSaveMessage("Aylık fiyat aralığı kaydedilirken bir hata oluştu.");
        return;
      }
      }

      const { data: updatedInstructor } = await supabase
        .from("instructors")
        .select(
          "id, category_id, is_approved, owner_auth_id, lesson_type, service_type, working_hours_start, working_hours_end",
        )
        .eq("id", instructorId)
        .eq("owner_auth_id", authUserId)
        .maybeSingle();

      if (updatedInstructor) {
        const savedCategoryId = parseInstructorCategoryId(
          (updatedInstructor as { category_id?: number | null }).category_id,
        );
        setCategoryId(savedCategoryId != null ? String(savedCategoryId) : "");
        onInstructorRowChange({
          ...instructorRow,
          ...updatedInstructor,
          min_fiyat: minFiyatValue,
          max_fiyat: maxFiyatValue,
          working_hours_start: availableHourStartValue,
          working_hours_end: availableHourEndValue,
        });
      } else {
        setCategoryId(String(categoryIdToSave));
        onInstructorRowChange({
          ...instructorRow,
          category_id: categoryIdToSave,
          min_fiyat: minFiyatValue,
          max_fiyat: maxFiyatValue,
          working_hours_start: availableHourStartValue,
          working_hours_end: availableHourEndValue,
        });
      }

      const entriesResult = await fetchInstructorFeatureEntriesClient(authUserId, instructorId, supabase);
      if (!entriesResult.error) {
        setFeatureEntries(entriesResult.entries);
        applyFormFromEntries(
          featureDefinitions,
          entriesResult.entries,
          entriesResult.entryChoices,
        );
      }

      flashSaveMessage(INSTRUCTOR_FEATURES_SAVE_SUCCESS);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="egitmen-panel-form-loading">Eğitmen özellikleri yükleniyor…</p>;
  }

  if (loadError) {
    return (
      <p className="egitmen-panel-save-message egitmen-panel-save-message--error" role="alert">
        {loadError}
      </p>
    );
  }

  const hasSelectedCategory = selectedCategoryNumericId != null;

  const selectionListProps = {
    getDisplayFeatureName: getDisplayInstructorFeatureName,
    instructorTextFeatureValues: form.textValues,
    setInstructorTextFeatureValues: setText,
    instructorNumberFeatureValues: form.numberValues,
    setInstructorNumberFeatureValues: setNumber,
    instructorDateFeatureValues: form.dateValues,
    setInstructorDateFeatureValues: setDate,
    instructorBooleanFeatureValues: form.booleanValues,
    setInstructorBooleanFeatureValues: setBoolean,
    instructorSingleSelectValues: form.singleSelectValues,
    setInstructorSingleSelectValues: setSingle,
    instructorMultiSelectValues: form.multiSelectValues,
    setInstructorMultiSelectValues: setMulti,
    instructorFeatureChoices: featureChoices,
    openInstructorSelectId,
    setOpenInstructorSelectId,
    studentAgeRangeError,
    setStudentAgeRangeError,
  };

  const availableHoursField = (
    <div className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full">
      <div className="egitmen-panel-features-feature-input-wrap">
        <p className="egitmen-panel-features-feature-name">Müsait Saat Aralığı</p>
        <div className="egitmen-panel-features-hours-range">
          <WorkingHoursTimePicker
            id="egitmen-available-hours-start"
            value={availableHourStart}
            onChange={setAvailableHourStart}
            ariaLabel="Müsait saat aralığı başlangıç"
            placeholder="Başlangıç"
          />
          <span className="egitmen-panel-features-hours-range-sep" aria-hidden>
            —
          </span>
          <WorkingHoursTimePicker
            id="egitmen-available-hours-end"
            value={availableHourEnd}
            onChange={setAvailableHourEnd}
            ariaLabel="Müsait saat aralığı bitiş"
            placeholder="Bitiş"
          />
        </div>
      </div>
    </div>
  );

  const priceRangeField = (
    <div className="egitmen-panel-features-selection-item egitmen-panel-features-feature-item--full">
      <div className="egitmen-panel-features-feature-input-wrap">
        <p className="egitmen-panel-features-feature-name">Fiyat Aralığı (TL)</p>
        <div className="egitmen-panel-features-price-range">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={minFiyat}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
                e.preventDefault();
              }
            }}
            onChange={(e) => setMinFiyat(e.target.value.replace(/[^\d]/g, ""))}
            className="egitmen-panel-features-feature-input egitmen-panel-features-feature-input--stepper"
            placeholder="Min"
            aria-label="Aylık fiyat minimum"
          />
          <span className="egitmen-panel-features-price-range-sep" aria-hidden>
            —
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={maxFiyat}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
                e.preventDefault();
              }
            }}
            onChange={(e) => setMaxFiyat(e.target.value.replace(/[^\d]/g, ""))}
            className="egitmen-panel-features-feature-input egitmen-panel-features-feature-input--stepper"
            placeholder="Max"
            aria-label="Aylık fiyat maksimum"
          />
        </div>
      </div>
    </div>
  );

  const saveButton = (
    <div className="egitmen-panel-features-actions">
      <Button
        type="button"
        variant="default"
        className="egitmen-panel-features-save-btn"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </div>
  );

  const categorySection = (
    <section className="egitmen-panel-features-section egitmen-panel-features-section--type-picker">
      <h4 className="egitmen-panel-features-group-title egitmen-panel-features-group-title--academic">
        <Shapes
          className="egitmen-panel-features-group-title-icon egitmen-panel-features-group-title-icon--academic"
          aria-hidden
        />
        Kategori
      </h4>
      <div className="egitmen-panel-features-feature-input-wrap">
        <p className="egitmen-panel-features-feature-name">Kategori</p>
        <div className="egitmen-panel-features-category-dropdown egitmen-panel-features-single-select-dropdown">
          <button
            type="button"
            className={`egitmen-panel-features-feature-select egitmen-panel-features-feature-select--button${
              openInstructorCategoryPicker ? " egitmen-panel-features-feature-select--open" : ""
            }`}
            onClick={() => {
              setOpenInstructorCategoryPicker((prev) => !prev);
              setOpenInstructorSelectId(null);
            }}
            aria-haspopup="listbox"
            aria-expanded={openInstructorCategoryPicker}
          >
            <span className="egitmen-panel-features-feature-select-label">{categoryDisplayName}</span>
          </button>
          {openInstructorCategoryPicker ? (
            <div className="egitmen-panel-features-feature-select-menu" role="listbox">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="option"
                  aria-selected={String(category.id) === categoryId}
                  className={`egitmen-panel-features-feature-select-option ${
                    String(category.id) === categoryId
                      ? "egitmen-panel-features-feature-select-option--selected"
                      : ""
                  }`}
                  onClick={() => {
                    const requestId = categoryChangeRequestRef.current + 1;
                    categoryChangeRequestRef.current = requestId;
                    const nextCategoryId = String(category.id);
                    const categoryName = category.name;
                    setOpenInstructorCategoryPicker(false);
                    if (nextCategoryId === categoryId) return;

                    const applyCategorySelection = () => {
                      if (categoryChangeRequestRef.current !== requestId) return;
                      const nextSlug = resolveInstructorCategorySlug(category.id, categories);
                      setCategoryId(nextCategoryId);
                      setForm((prev) =>
                        stripInstructorCategorySpecificFeatureFormValues(
                          prev,
                          featureDefinitions,
                          featureGroups,
                          nextSlug,
                        ),
                      );
                      setOpenInstructorSelectId(null);
                      setStudentAgeRangeError(null);
                    };

                    if (!hasValidInstructorId) {
                      applyCategorySelection();
                      return;
                    }

                    void (async () => {
                      try {
                        const supabase = createSupabaseBrowserClient();
                        const relations = await loadInstructorExtraCategoryRelationsClient(
                          supabase,
                          instructorId,
                        );
                        if (categoryChangeRequestRef.current !== requestId) return;
                        const isSavedExtraBranch = relations.some(
                          (relation) => relation.categoryId === category.id,
                        );
                        if (isSavedExtraBranch) {
                          setBlockedExtraBranchCategoryName(categoryName);
                          return;
                        }
                      } catch (error) {
                        if (categoryChangeRequestRef.current !== requestId) return;
                        console.error("Instructor category change extra-branch check error:", error);
                        setCategoryChangeCheckError(
                          "Ek branş kayıtları kontrol edilemedi. Kategori değiştirilmedi.",
                        );
                        return;
                      }
                      applyCategorySelection();
                    })();
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!hasSelectedCategory ? (
          <p className="egitmen-panel-features-category-note">
            Kategoriye özel özellikleri görmek için önce bir kategori seçin.
          </p>
        ) : null}
      </div>
    </section>
  );

  const upperContent = (
    <div className="egitmen-panel-features-content">
      <div className="egitmen-panel-features-groups">
        {categorySection}
        {hasSelectedCategory && groupsWithFeatures.length === 0 ? (
          <p className="egitmen-panel-features-empty-text">Aktif özellik grubu bulunamadı.</p>
        ) : null}
        <InstructorFeatureSelectionGroupList
          groups={upperGroups}
          baslicaPriceRange={priceRangeField}
          baslicaAvailableHours={availableHoursField}
          onLessonDurationPanelError={setLessonDurationPanelError}
          {...selectionListProps}
        />
        <FeatureHighlightsCard
          candidates={highlightCandidates}
          selected={highlightSelections}
          onChange={(next) => {
            setHighlightWarning(null);
            setHighlightSelections(next);
          }}
          warning={highlightWarning}
        />
        {!splitLayout || lowerGroups.length === 0 ? saveButton : null}
      </div>
    </div>
  );

  const lowerContent =
    lowerGroups.length > 0 ? (
      <div className="egitmen-panel-features-content">
        <div className="egitmen-panel-features-groups">
          <InstructorFeatureSelectionGroupList groups={lowerGroups} {...selectionListProps} />
          {saveButton}
        </div>
      </div>
    ) : null;

  const overlays = (
    <>
      <SavingOverlay visible={saving} text="Kaydediliyor" />

      {saveToastMessage ? (
        <div className="panel-features-save-toast-overlay" role="presentation">
          <div
            className={`panel-features-save-toast-modal${
              saveToastMessage.toLocaleLowerCase("tr-TR").includes("hata") ||
              saveToastMessage.toLocaleLowerCase("tr-TR").includes("lütfen")
                ? " panel-features-save-toast-modal--error"
                : ""
            }`}
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-describedby="egitmen-features-save-toast-desc"
          >
            <p id="egitmen-features-save-toast-desc" className="panel-features-save-toast-text">
              {saveToastMessage}
            </p>
          </div>
        </div>
      ) : null}

      {blockedExtraBranchCategoryName ? (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="egitmen-category-change-blocked-title"
          onClick={() => setBlockedExtraBranchCategoryName(null)}
        >
          <div
            className="app-modal-content app-modal-content--warning"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="egitmen-category-change-blocked-title" className="app-modal-title">
              Kategori Değiştirilemiyor
            </h2>
            <div className="app-modal-body">
              <p className="app-modal-message">
                Seçmek istediğiniz {blockedExtraBranchCategoryName} kategorisi, Ek Branşlar
                listenizde zaten bulunuyor.
              </p>
              <p className="app-modal-message">
                Devam etmek için önce bu kategoriyi Ek Branşlar alanından kaldırıp değişiklikleri
                kaydedin.
              </p>
              <p className="app-modal-message">
                Ek Branşı kaldırdığınızda bu branşa ait seçilmiş türler de silinir.
              </p>
            </div>
            <div className="app-modal-footer">
              <Button
                type="button"
                variant="default"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => setBlockedExtraBranchCategoryName(null)}
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {categoryChangeCheckError ? (
        <div
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="egitmen-category-change-check-error-title"
          onClick={() => setCategoryChangeCheckError(null)}
        >
          <div
            className="app-modal-content app-modal-content--error"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="egitmen-category-change-check-error-title" className="app-modal-title">
              Kategori Değiştirilemiyor
            </h2>
            <div className="app-modal-body">
              <p className="app-modal-message">{categoryChangeCheckError}</p>
            </div>
            <div className="app-modal-footer">
              <Button
                type="button"
                variant="default"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => setCategoryChangeCheckError(null)}
              >
                Tamam
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (splitLayout) {
    return (
      <>
        <div className="egitmen-panel-page-main">
          {leadingSlot}
          <section className="egitmen-panel-main-card" aria-labelledby="instructor-card-title">
            {header}
            {upperContent}
          </section>
        </div>
        {lowerContent ? (
          <div className="egitmen-panel-features-feature-wide">
            <section className="egitmen-panel-main-card" aria-label="Eğitmen özellikleri (devam)">
              {lowerContent}
            </section>
          </div>
        ) : null}
        {hasValidInstructorId ? (
          <div className="egitmen-panel-features-feature-wide">
            <InstructorExtraBranchesSection
              ref={extraBranchesRef}
              instructorId={String(instructorId)}
              mainCategoryId={categoryId || null}
              onSlotCountChange={onExtraBranchSlotCountChange}
            />
          </div>
        ) : null}
        {overlays}
      </>
    );
  }

  return (
    <>
      <div className="egitmen-panel-features-content">
        <div className="egitmen-panel-features-groups">
          {categorySection}
          {hasSelectedCategory && groupsWithFeatures.length === 0 ? (
            <p className="egitmen-panel-features-empty-text">Aktif özellik grubu bulunamadı.</p>
          ) : null}
          <InstructorFeatureSelectionGroupList
            groups={upperGroups}
            baslicaPriceRange={priceRangeField}
            baslicaAvailableHours={availableHoursField}
            onLessonDurationPanelError={setLessonDurationPanelError}
            {...selectionListProps}
          />
          {lowerContent ? (
            <InstructorFeatureSelectionGroupList groups={lowerGroups} {...selectionListProps} />
          ) : null}
          {saveButton}
        </div>
      </div>
      {overlays}
    </>
  );
}
