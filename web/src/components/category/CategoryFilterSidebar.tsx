"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RotateCcw, Search } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ANKARA_DISTRICTS } from "@/constants/districts";
import type { SchoolCategoryFilterPayload } from "@/components/category/schoolCategoryFilterTypes";

export interface CategoryFilterConfig {
  categories?: Array<{ label: string; count: number; value: string }>;
}

interface CategoryFilterSidebarProps {
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
  /**
   * Verildiğinde sidebar, mock KATEGORİLER ve AYLIK ÜCRET bölümleri yerine
   * ilgili kategoriye ait gerçek feature_groups/feature_definitions/feature_choices
   * verilerini DB'den çeker ve render eder. Ayrıca "Alt Kategori" ile
   * "Başlıca Özellikler" alanları (slug'tan bağımsız ortak grup) bu modda gösterilir.
   */
  categorySlug?: string;
}

interface FilterState {
  search: string;
  city: string;
  district: string;
  category: string;
  priceRange: [number, number];
}

const defaultCategories = [
  { label: "Anaokulu / Kreş", count: 12, value: "anaokulu" },
  { label: "İlkokul", count: 8, value: "ilkokul" },
  { label: "Ortaokul", count: 5, value: "ortaokul" },
  { label: "Lise", count: 9, value: "lise" },
];

type FeatureGroupRow = {
  id: number;
  name: string | null;
  display_order: number | null;
  is_active: boolean | null;
  category_slug: string | null;
};

type FeatureDefinitionRow = {
  id: number;
  group_id: number | null;
  name: string | null;
  input_type: string | null;
  display_order: number | null;
  is_active: boolean | null;
  unit?: string | null;
};

type FeatureChoiceRow = {
  id: number;
  feature_definition_id: number | null;
  name: string | null;
  display_order: number | null;
  is_active: boolean | null;
};

type InstitutionTypeRow = {
  id: number;
  name: string | null;
  category_id: number | null;
  display_order: number | null;
  is_active: boolean | null;
};

/** UI'da bir grup için flatten edilmiş seçenek satırı. */
type FeatureFilterOption = {
  /** Benzersiz seçim anahtarı: choice ya da boolean definition referansı. */
  key: string;
  label: string;
};

type FeatureFilterGroup = {
  id: number;
  name: string;
  options: FeatureFilterOption[];
};

/** Başlıca Özellikler için bir input. */
type CommonField =
  | {
      kind: "single_select";
      definitionId: number;
      name: string;
      placeholder: string;
      choices: Array<{ id: number; name: string }>;
    }
  | {
      kind: "multi_select";
      definitionId: number;
      name: string;
      choices: Array<{ id: number; name: string }>;
    }
  | {
      kind: "number_range";
      definitionId: number;
      name: string;
      unit: string | null;
    };

const FEATURE_OPTIONS_VISIBLE_LIMIT = 10;
const COMMON_GROUP_NAME_KEY = "başlıca özellikler";
const ALL_DISTRICTS_VALUE = "__all__";
const CLEAR_SINGLE_SELECT_VALUE = "__clear__";

function describeSupabaseError(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
} {
  if (err == null) return { message: "unknown" };
  if (typeof err === "string") return { message: err };
  const e = err as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    name?: string;
  };
  return {
    message: String(e.message ?? "unknown"),
    code: e.code,
    details: e.details,
    hint: e.hint,
    status: e.status,
    name: e.name,
  };
}

/** Detay sayfasındaki kuralla uyumlu: bazı feature isimlerini sidebar'da farklı göster. */
function getDisplayFeatureName(name: string): string {
  const trimmed = (name ?? "").trim();
  const key = trimmed.toLocaleLowerCase("tr-TR");
  if (key === "fiyat aralığı") return "Aylık Ortalama Fiyat Aralığı";
  return trimmed;
}

type UseCategoryFilterSidebarModelArgs = {
  /** false: Okul sayfasında paylaşımlı Provider modeli kullanılırken boş model (çift fetch yok). */
  enabled?: boolean;
  config?: CategoryFilterConfig;
  onFilterChange?: (filters: FilterState) => void;
  categorySlug?: string;
  linkedSearch?: string;
  onLinkedSearchChange?: (value: string) => void;
  linkedDistrict?: string;
  onLinkedDistrictChange?: (value: string) => void;
  onSchoolFilterPayloadChange?: (payload: SchoolCategoryFilterPayload) => void;
};

function useCategoryFilterSidebarModel({
  enabled = true,
  config,
  onFilterChange,
  categorySlug,
  linkedSearch,
  onLinkedSearchChange,
  linkedDistrict,
  onLinkedDistrictChange,
  onSchoolFilterPayloadChange,
}: UseCategoryFilterSidebarModelArgs) {
  const [search, setSearch] = useState("");
  // Ana sayfayla uyumlu olarak şehir Ankara'ya sabit (disabled dropdown).
  const [city, setCity] = useState("ankara");
  const [district, setDistrict] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);

  // DB'den çekilen kategoriye özgü feature group + option verisi
  const [featureGroups, setFeatureGroups] = useState<FeatureFilterGroup[]>([]);
  const [featureGroupsLoading, setFeatureGroupsLoading] = useState(false);
  const [featureGroupsError, setFeatureGroupsError] = useState<string | null>(null);

  const [selectedFeatureOptionsByGroup, setSelectedFeatureOptionsByGroup] = useState<
    Record<number, Set<string>>
  >({});

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(new Set());

  const [subcategoryTypes, setSubcategoryTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

  const [commonFields, setCommonFields] = useState<CommonField[]>([]);
  const [selectedCommonSingle, setSelectedCommonSingle] = useState<Record<number, string>>({});
  const [selectedCommonMulti, setSelectedCommonMulti] = useState<Record<number, Set<string>>>({});
  const [selectedCommonRange, setSelectedCommonRange] = useState<
    Record<number, { min: string; max: string }>
  >({});
  const [expandedCommonMultiIds, setExpandedCommonMultiIds] = useState<Set<number>>(new Set());

  const categories = config?.categories || defaultCategories;
  const effectiveSlug = enabled ? String(categorySlug ?? "").trim() : "";
  const hasDynamicFeatureMode = effectiveSlug.length > 0;
  const isLinkedSearch = typeof onLinkedSearchChange === "function";
  const isLinkedDistrict = typeof onLinkedDistrictChange === "function";
  const displaySearch = isLinkedSearch ? (linkedSearch ?? "") : search;
  const displayDistrict = isLinkedDistrict ? (linkedDistrict ?? "") : district;

  // Kategoriye özel feature gruplarını + tanımlarını + seçeneklerini yükle.
  useEffect(() => {
    if (!hasDynamicFeatureMode) {
      setFeatureGroups([]);
      setFeatureGroupsError(null);
      setFeatureGroupsLoading(false);
      return;
    }

    let cancelled = false;
    setFeatureGroupsLoading(true);
    setFeatureGroupsError(null);

    (async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: groupsData, error: groupsError } = await supabase
        .from("institution_feature_groups")
        .select("id, name, display_order, is_active, category_slug")
        .eq("is_active", true)
        .eq("category_slug", effectiveSlug)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;

      if (groupsError) {
        console.error(
          "[category-filter][feature-groups][error]",
          describeSupabaseError(groupsError),
        );
        setFeatureGroupsError("Filtreler yüklenemedi.");
        setFeatureGroups([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const groupRows = ((groupsData ?? []) as FeatureGroupRow[]).filter((g) =>
        Boolean((g.name ?? "").trim()),
      );

      if (groupRows.length === 0) {
        setFeatureGroups([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const groupIds = groupRows.map((g) => g.id);
      const { data: definitionsData, error: definitionsError } = await supabase
        .from("institution_feature_definitions")
        .select("id, group_id, name, input_type, display_order, is_active")
        .eq("is_active", true)
        .in("group_id", groupIds)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;

      if (definitionsError) {
        console.error(
          "[category-filter][feature-definitions][error]",
          describeSupabaseError(definitionsError),
        );
        setFeatureGroupsError("Filtreler yüklenemedi.");
        setFeatureGroups([]);
        setFeatureGroupsLoading(false);
        return;
      }

      const definitionRows = (definitionsData ?? []) as FeatureDefinitionRow[];
      const definitionIds = definitionRows.map((d) => d.id);

      let choiceRows: FeatureChoiceRow[] = [];
      if (definitionIds.length > 0) {
        const { data: choicesData, error: choicesError } = await supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .in("feature_definition_id", definitionIds)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });

        if (cancelled) return;

        if (choicesError) {
          console.error(
            "[category-filter][feature-choices][error]",
            describeSupabaseError(choicesError),
          );
          setFeatureGroupsError("Filtreler yüklenemedi.");
          setFeatureGroups([]);
          setFeatureGroupsLoading(false);
          return;
        }

        choiceRows = (choicesData ?? []) as FeatureChoiceRow[];
      }

      // Definitions group_id bazlı sınıflandır.
      const definitionsByGroup = new Map<number, FeatureDefinitionRow[]>();
      definitionRows.forEach((def) => {
        if (def.group_id == null) return;
        const arr = definitionsByGroup.get(def.group_id) ?? [];
        arr.push(def);
        definitionsByGroup.set(def.group_id, arr);
      });

      // Choices definition bazlı sınıflandır.
      const choicesByDefinition = new Map<number, FeatureChoiceRow[]>();
      choiceRows.forEach((choice) => {
        if (choice.feature_definition_id == null) return;
        const arr = choicesByDefinition.get(choice.feature_definition_id) ?? [];
        arr.push(choice);
        choicesByDefinition.set(choice.feature_definition_id, arr);
      });

      const builtGroups: FeatureFilterGroup[] = groupRows
        .map((group): FeatureFilterGroup | null => {
          const defs = definitionsByGroup.get(group.id) ?? [];
          const options: FeatureFilterOption[] = [];
          const seenLabels = new Set<string>();

          defs.forEach((def) => {
            const inputType = String(def.input_type ?? "").trim().toLowerCase();
            const defName = String(def.name ?? "").trim();

            if (inputType === "boolean") {
              if (!defName) return;
              const key = `def:${def.id}`;
              if (seenLabels.has(defName.toLocaleLowerCase("tr-TR"))) return;
              seenLabels.add(defName.toLocaleLowerCase("tr-TR"));
              options.push({ key, label: defName });
              return;
            }

            if (inputType === "single_select" || inputType === "multi_select") {
              const choices = choicesByDefinition.get(def.id) ?? [];
              choices.forEach((choice) => {
                const label = String(choice.name ?? "").trim();
                if (!label) return;
                const labelKey = label.toLocaleLowerCase("tr-TR");
                if (seenLabels.has(labelKey)) return;
                seenLabels.add(labelKey);
                options.push({ key: `choice:${choice.id}:def:${def.id}`, label });
              });
              return;
            }

            // number / text vb. — bu sürümde (filtreleme henüz aktif değil)
            // option olarak render edilmiyor.
          });

          if (options.length === 0) return null;

          return {
            id: group.id,
            name: String(group.name ?? "").trim(),
            options,
          };
        })
        .filter((g): g is FeatureFilterGroup => g !== null);

      setFeatureGroups(builtGroups);
      setFeatureGroupsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, hasDynamicFeatureMode]);

  // Alt Kategori — institution_types (kategoriye bağlı). Slug verildiğinde aktif.
  useEffect(() => {
    if (!hasDynamicFeatureMode) {
      setSubcategoryTypes([]);
      setSelectedSubcategoryId("");
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();

      const { data: catData, error: catError } = await supabase
        .from("institution_categories")
        .select("id, slug, is_active")
        .eq("is_active", true)
        .eq("slug", effectiveSlug)
        .maybeSingle();

      if (cancelled) return;

      if (catError) {
        console.error(
          "[category-filter][institution-categories][error]",
          describeSupabaseError(catError),
        );
        setSubcategoryTypes([]);
        return;
      }

      const categoryId = (catData as { id: number | null } | null)?.id ?? null;
      if (!categoryId) {
        setSubcategoryTypes([]);
        return;
      }

      const { data: typesData, error: typesError } = await supabase
        .from("institution_types")
        .select("id, name, category_id, display_order, is_active")
        .eq("is_active", true)
        .eq("category_id", categoryId)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (typesError) {
        console.error(
          "[category-filter][institution-types][error]",
          describeSupabaseError(typesError),
        );
        setSubcategoryTypes([]);
        return;
      }

      const types = ((typesData ?? []) as InstitutionTypeRow[])
        .map((row) => ({ id: row.id, name: String(row.name ?? "").trim() }))
        .filter((t) => Boolean(t.name));

      setSubcategoryTypes(types);
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, hasDynamicFeatureMode]);

  // "Başlıca Özellikler" feature group + definitions + choices (slug'tan bağımsız).
  useEffect(() => {
    if (!hasDynamicFeatureMode) {
      setCommonFields([]);
      setSelectedCommonSingle({});
      setSelectedCommonMulti({});
      setSelectedCommonRange({});
      return;
    }

    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();

      // Tüm aktif gruplar (genelde küçük bir tablodur); name-eşleşmesiyle "Başlıca Özellikler"i seç.
      const { data: groupsData, error: groupsError } = await supabase
        .from("institution_feature_groups")
        .select("id, name, display_order, is_active, category_slug")
        .eq("is_active", true)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;
      if (groupsError) {
        console.error(
          "[category-filter][common-group][groups-error]",
          describeSupabaseError(groupsError),
        );
        setCommonFields([]);
        return;
      }

      const groups = (groupsData ?? []) as FeatureGroupRow[];
      const commonGroup = groups.find(
        (g) => (g.name ?? "").trim().toLocaleLowerCase("tr-TR") === COMMON_GROUP_NAME_KEY,
      );
      if (!commonGroup) {
        setCommonFields([]);
        return;
      }

      const { data: definitionsData, error: definitionsError } = await supabase
        .from("institution_feature_definitions")
        .select("id, group_id, name, input_type, display_order, is_active, unit")
        .eq("is_active", true)
        .eq("group_id", commonGroup.id)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });

      if (cancelled) return;
      if (definitionsError) {
        console.error(
          "[category-filter][common-group][defs-error]",
          describeSupabaseError(definitionsError),
        );
        setCommonFields([]);
        return;
      }

      const defs = ((definitionsData ?? []) as FeatureDefinitionRow[]).filter((d) =>
        Boolean((d.name ?? "").trim()),
      );

      const defIds = defs.map((d) => d.id);
      let choices: FeatureChoiceRow[] = [];
      if (defIds.length > 0) {
        const { data: choicesData, error: choicesError } = await supabase
          .from("institution_feature_choices")
          .select("id, feature_definition_id, name, display_order, is_active")
          .eq("is_active", true)
          .in("feature_definition_id", defIds)
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true });

        if (cancelled) return;
        if (choicesError) {
          console.error(
            "[category-filter][common-group][choices-error]",
            describeSupabaseError(choicesError),
          );
          setCommonFields([]);
          return;
        }
        choices = (choicesData ?? []) as FeatureChoiceRow[];
      }

      const choicesByDef = new Map<number, FeatureChoiceRow[]>();
      choices.forEach((c) => {
        if (c.feature_definition_id == null) return;
        const arr = choicesByDef.get(c.feature_definition_id) ?? [];
        arr.push(c);
        choicesByDef.set(c.feature_definition_id, arr);
      });

      const fields: CommonField[] = [];
      defs.forEach((def) => {
        const displayName = getDisplayFeatureName(def.name ?? "");
        const inputType = String(def.input_type ?? "").trim().toLowerCase();
        const defChoices = (choicesByDef.get(def.id) ?? [])
          .map((c) => ({ id: c.id, name: String(c.name ?? "").trim() }))
          .filter((c) => Boolean(c.name));

        if (inputType === "single_select") {
          if (defChoices.length === 0) return;
          fields.push({
            kind: "single_select",
            definitionId: def.id,
            name: displayName,
            placeholder: `${displayName} seçin`,
            choices: defChoices,
          });
        } else if (inputType === "multi_select") {
          if (defChoices.length === 0) return;
          fields.push({
            kind: "multi_select",
            definitionId: def.id,
            name: displayName,
            choices: defChoices,
          });
        } else if (inputType === "number") {
          fields.push({
            kind: "number_range",
            definitionId: def.id,
            name: displayName,
            unit: (def.unit ?? "").trim() || null,
          });
        }
        // boolean / text → bu sürümde Başlıca Özellikler bloğunda atla.
      });

      setCommonFields(fields);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasDynamicFeatureMode]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    const nextSearch = updates.search !== undefined ? updates.search : displaySearch;
    const nextDistrict = updates.district !== undefined ? updates.district : displayDistrict;
    const newFilters = {
      search: nextSearch,
      city,
      district: nextDistrict,
      category: selectedCategory,
      priceRange,
      ...updates,
    };

    if (updates.search !== undefined) {
      if (isLinkedSearch) onLinkedSearchChange?.(updates.search);
      else setSearch(updates.search);
    }
    if (updates.city !== undefined) setCity(updates.city);
    if (updates.district !== undefined) {
      if (isLinkedDistrict) onLinkedDistrictChange?.(updates.district);
      else setDistrict(updates.district);
    }
    if (updates.category !== undefined) setSelectedCategory(updates.category);
    if (updates.priceRange !== undefined) setPriceRange(updates.priceRange);

    onFilterChange?.(newFilters);
  };

  const handlePriceInput = (index: 0 | 1, value: string) => {
    if (value === "") {
      const newRange: [number, number] = [...priceRange];
      newRange[index] = index === 0 ? 0 : 50000;
      handleFilterChange({ priceRange: newRange });
      return;
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    const newRange: [number, number] = [...priceRange];
    newRange[index] = numValue;

    if (index === 0 && newRange[0] > newRange[1]) {
      newRange[1] = newRange[0];
    } else if (index === 1 && newRange[1] < newRange[0]) {
      newRange[0] = newRange[1];
    }

    handleFilterChange({ priceRange: newRange });
  };

  const toggleFeatureOption = (groupId: number, optionKey: string) => {
    setSelectedFeatureOptionsByGroup((prev) => {
      const current = new Set(prev[groupId] ?? new Set<string>());
      if (current.has(optionKey)) current.delete(optionKey);
      else current.add(optionKey);
      return { ...prev, [groupId]: current };
    });
  };

  const toggleGroupExpanded = (groupId: number) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleCommonMulti = (definitionId: number, choiceId: number) => {
    setSelectedCommonMulti((prev) => {
      const current = new Set(prev[definitionId] ?? new Set<string>());
      const key = String(choiceId);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [definitionId]: current };
    });
  };

  const toggleCommonMultiExpanded = (definitionId: number) => {
    setExpandedCommonMultiIds((prev) => {
      const next = new Set(prev);
      if (next.has(definitionId)) next.delete(definitionId);
      else next.add(definitionId);
      return next;
    });
  };

  const setCommonRange = (definitionId: number, edge: "min" | "max", value: string) => {
    setSelectedCommonRange((prev) => {
      const current = prev[definitionId] ?? { min: "", max: "" };
      return { ...prev, [definitionId]: { ...current, [edge]: value } };
    });
  };

  const onSchoolFilterPayloadChangeRef = useRef(onSchoolFilterPayloadChange);
  onSchoolFilterPayloadChangeRef.current = onSchoolFilterPayloadChange;

  const commonSingleKey = useMemo(() => JSON.stringify(selectedCommonSingle), [selectedCommonSingle]);
  const commonRangeKey = useMemo(() => JSON.stringify(selectedCommonRange), [selectedCommonRange]);

  const commonMultiKey = useMemo(() => {
    return Object.keys(selectedCommonMulti)
      .sort((a, b) => Number(a) - Number(b))
      .map((did) => {
        const keys = Array.from(selectedCommonMulti[Number(did)] ?? new Set<string>()).sort();
        return `${did}:${keys.join(",")}`;
      })
      .join("|");
  }, [selectedCommonMulti]);

  const featureGroupSelectionsKey = useMemo(() => {
    return Object.keys(selectedFeatureOptionsByGroup)
      .sort((a, b) => Number(a) - Number(b))
      .map((gid) => {
        const keys = Array.from(selectedFeatureOptionsByGroup[Number(gid)] ?? new Set<string>()).sort();
        return `${gid}:${keys.join(",")}`;
      })
      .join("|");
  }, [selectedFeatureOptionsByGroup]);

  useEffect(() => {
    const emitPayload = onSchoolFilterPayloadChangeRef.current;
    if (!emitPayload || !hasDynamicFeatureMode) return;

    const rawSub = selectedSubcategoryId.trim();
    const institutionTypeId =
      rawSub && Number.isFinite(Number(rawSub)) && Number(rawSub) > 0 ? Number(rawSub) : null;

    const commonSingle: Record<number, string> = {};
    for (const [k, v] of Object.entries(selectedCommonSingle)) {
      const id = Number(k);
      const sv = String(v ?? "").trim();
      if (!Number.isFinite(id) || !sv || sv === CLEAR_SINGLE_SELECT_VALUE) continue;
      commonSingle[id] = sv;
    }

    const commonMulti: Record<number, string[]> = {};
    for (const [k, set] of Object.entries(selectedCommonMulti)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const arr = Array.from(set ?? []).filter(Boolean);
      if (arr.length === 0) continue;
      commonMulti[id] = arr;
    }

    const commonRange: Record<number, { min: string; max: string }> = {};
    for (const [k, r] of Object.entries(selectedCommonRange)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const minS = String(r?.min ?? "").trim();
      const maxS = String(r?.max ?? "").trim();
      if (!minS && !maxS) continue;
      commonRange[id] = { min: minS, max: maxS };
    }

    const groupSelections: Record<number, string[]> = {};
    for (const [gid, set] of Object.entries(selectedFeatureOptionsByGroup)) {
      const id = Number(gid);
      if (!Number.isFinite(id)) continue;
      const keys = Array.from(set ?? []);
      if (keys.length === 0) continue;
      groupSelections[id] = keys;
    }

    emitPayload({
      institutionTypeId,
      commonSingle,
      commonMulti,
      commonRange,
      groupSelections,
    });
    // Bağımlılık olarak state'lerin kararlı JSON anahtarları kullanılıyor;
    // state objelerinin kendileri referans-yenileme tetiklediği için eklenmedi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasDynamicFeatureMode,
    selectedSubcategoryId,
    commonSingleKey,
    commonMultiKey,
    commonRangeKey,
    featureGroupSelectionsKey,
  ]);

  const renderedFeatureGroups = useMemo(() => featureGroups, [featureGroups]);

  /** En az bir filtre aktif mi? Sıfırlama butonunun görünürlüğünü belirler. */
  const hasActiveFilters = useMemo(() => {
    if (String(displaySearch ?? "").trim()) return true;
    if (String(displayDistrict ?? "").trim()) return true;
    if (String(selectedSubcategoryId ?? "").trim()) return true;
    for (const v of Object.values(selectedCommonSingle)) {
      const s = String(v ?? "").trim();
      if (s && s !== CLEAR_SINGLE_SELECT_VALUE) return true;
    }
    for (const set of Object.values(selectedCommonMulti)) {
      if ((set?.size ?? 0) > 0) return true;
    }
    for (const r of Object.values(selectedCommonRange)) {
      if (String(r?.min ?? "").trim() !== "" || String(r?.max ?? "").trim() !== "") return true;
    }
    for (const set of Object.values(selectedFeatureOptionsByGroup)) {
      if ((set?.size ?? 0) > 0) return true;
    }
    return false;
  }, [
    displaySearch,
    displayDistrict,
    selectedSubcategoryId,
    selectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    selectedFeatureOptionsByGroup,
  ]);

  /**
   * Tüm filtre state'ini default değerlere döndürür. Linked search/district için
   * parent state'i de boş değerle bildirir. Sidebar feature payload'u zaten boş
   * state'ten otomatik olarak boş emit edileceği için ekstra çağrı gerekmez.
   */
  const resetAll = useCallback(() => {
    setSearch("");
    setDistrict("");
    setSelectedCategory("");
    setPriceRange([0, 50000]);
    setSelectedSubcategoryId("");
    setSelectedCommonSingle({});
    setSelectedCommonMulti({});
    setSelectedCommonRange({});
    setSelectedFeatureOptionsByGroup({});
    setExpandedGroupIds(new Set());
    setExpandedCommonMultiIds(new Set());
    if (isLinkedSearch) onLinkedSearchChange?.("");
    if (isLinkedDistrict) onLinkedDistrictChange?.("");
  }, [isLinkedSearch, isLinkedDistrict, onLinkedSearchChange, onLinkedDistrictChange]);

  return {
    categories,
    hasDynamicFeatureMode,
    displaySearch,
    displayDistrict,
    city,
    district,
    search,
    selectedCategory,
    priceRange,
    featureGroups,
    featureGroupsLoading,
    featureGroupsError,
    selectedFeatureOptionsByGroup,
    expandedGroupIds,
    subcategoryTypes,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    commonFields,
    selectedCommonSingle,
    setSelectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    expandedCommonMultiIds,
    handleFilterChange,
    handlePriceInput,
    toggleFeatureOption,
    toggleGroupExpanded,
    toggleCommonMulti,
    toggleCommonMultiExpanded,
    setCommonRange,
    renderedFeatureGroups,
    hasActiveFilters,
    resetAll,
  };
}

type CategoryFilterSidebarModel = ReturnType<typeof useCategoryFilterSidebarModel>;

const SchoolCategoryFilterPanelContext = createContext<CategoryFilterSidebarModel | null>(null);

export function SchoolCategoryFilterPanelProvider({
  children,
  categorySlug,
  linkedSearch,
  onLinkedSearchChange,
  linkedDistrict,
  onLinkedDistrictChange,
  onSchoolFilterPayloadChange,
}: {
  children: ReactNode;
  categorySlug: string;
  linkedSearch: string;
  onLinkedSearchChange: (value: string) => void;
  linkedDistrict: string;
  onLinkedDistrictChange: (value: string) => void;
  onSchoolFilterPayloadChange: (payload: SchoolCategoryFilterPayload) => void;
}) {
  const model = useCategoryFilterSidebarModel({
    enabled: true,
    categorySlug,
    linkedSearch,
    onLinkedSearchChange,
    linkedDistrict,
    onLinkedDistrictChange,
    onSchoolFilterPayloadChange,
  });
  return (
    <SchoolCategoryFilterPanelContext.Provider value={model}>{children}</SchoolCategoryFilterPanelContext.Provider>
  );
}

function CategoryFilterSidebarView({ model }: { model: CategoryFilterSidebarModel }) {
  const {
    categories,
    hasDynamicFeatureMode,
    displaySearch,
    displayDistrict,
    city,
    selectedCategory,
    priceRange,
    featureGroupsLoading,
    featureGroupsError,
    selectedFeatureOptionsByGroup,
    expandedGroupIds,
    commonFields,
    selectedCommonSingle,
    setSelectedCommonSingle,
    selectedCommonMulti,
    selectedCommonRange,
    expandedCommonMultiIds,
    handleFilterChange,
    handlePriceInput,
    toggleFeatureOption,
    toggleGroupExpanded,
    toggleCommonMulti,
    toggleCommonMultiExpanded,
    setCommonRange,
    renderedFeatureGroups,
  } = model;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasAdvancedFilters =
    commonFields.length > 0 || renderedFeatureGroups.length > 0;
  const showLoginHint =
    hasDynamicFeatureMode &&
    !featureGroupsLoading &&
    isAuthenticated === false &&
    !hasAdvancedFilters;

  return (
    <aside className="category-filter-sidebar">
      <div className="category-filter-sidebar-card">
        <div className="category-filter-sidebar-header">
          <div className="category-filter-sidebar-header-content">
            <Image
              src="/images/filter.svg"
              alt="Filtreleme"
              width={20}
              height={20}
              className="category-filter-sidebar-header-icon"
            />
            <h2 className="category-filter-sidebar-header-title">Filtreleme</h2>
          </div>
        </div>

        <div className="category-filter-sidebar-content">
          <div className="category-filter-section">
            <h3 className="category-filter-section-title">ARAMA</h3>
            <div className="category-filter-section-inputs">
              <div className="category-filter-search-wrapper">
                <Search size={18} className="category-filter-search-icon" />
                <Input
                  type="text"
                  placeholder="Kurum adı ara..."
                  value={displaySearch}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="category-filter-search-input"
                />
              </div>
            </div>
          </div>

          <div className="category-filter-section">
            <h3 className="category-filter-section-title">KONUM</h3>
            <div className="category-filter-section-inputs">
              <Select value={city} disabled>
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="Şehir Seçin" />
                </SelectTrigger>
                <SelectContent
                  className="select-content home-location-dropdown"
                  side="bottom"
                  avoidCollisions={false}
                >
                  <SelectItem value="ankara" className="select-item">
                    Ankara
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={displayDistrict ? displayDistrict : ALL_DISTRICTS_VALUE}
                onValueChange={(value) =>
                  handleFilterChange({ district: value === ALL_DISTRICTS_VALUE ? "" : value })
                }
              >
                <SelectTrigger className="category-filter-select">
                  <SelectValue placeholder="İlçe Seçin" />
                </SelectTrigger>
                <SelectContent
                  className="select-content home-location-dropdown"
                  side="bottom"
                  avoidCollisions={false}
                >
                  <SelectItem value={ALL_DISTRICTS_VALUE} className="select-item">
                    Tüm İlçeler
                  </SelectItem>
                  {ANKARA_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d} className="select-item">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasDynamicFeatureMode ? (
            <>
              {commonFields.map((field) => {
                if (field.kind === "single_select") {
                  const selectedValue = selectedCommonSingle[field.definitionId] ?? "";
                  const selectValue = selectedValue ? String(selectedValue) : CLEAR_SINGLE_SELECT_VALUE;
                  return (
                    <div
                      className="category-filter-section"
                      key={`common-${field.definitionId}`}
                    >
                      <h3 className="category-filter-section-title">
                        {field.name.toLocaleUpperCase("tr-TR")}
                      </h3>
                      <div className="category-filter-section-inputs">
                        <Select
                          value={selectValue}
                          onValueChange={(value) =>
                            setSelectedCommonSingle((prev) => ({
                              ...prev,
                              [field.definitionId]:
                                value === CLEAR_SINGLE_SELECT_VALUE ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger className="category-filter-select">
                            <SelectValue placeholder={field.placeholder} />
                          </SelectTrigger>
                          <SelectContent
                            className="select-content home-location-dropdown"
                            side="bottom"
                            avoidCollisions={false}
                          >
                            <SelectItem value={CLEAR_SINGLE_SELECT_VALUE} className="select-item">
                              Tümü
                            </SelectItem>
                            {field.choices.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)} className="select-item">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                }

                if (field.kind === "number_range") {
                  const value = selectedCommonRange[field.definitionId] ?? { min: "", max: "" };
                  return (
                    <div
                      className="category-filter-section"
                      key={`common-${field.definitionId}`}
                    >
                      <h3 className="category-filter-section-title">
                        {field.name.toLocaleUpperCase("tr-TR")}
                      </h3>
                      <div className="category-filter-price-inputs">
                        <Input
                          type="number"
                          value={value.min}
                          onChange={(e) => setCommonRange(field.definitionId, "min", e.target.value)}
                          placeholder="Min"
                          min="0"
                          className="category-filter-price-input"
                        />
                        <span className="category-filter-price-separator">-</span>
                        <Input
                          type="number"
                          value={value.max}
                          onChange={(e) => setCommonRange(field.definitionId, "max", e.target.value)}
                          placeholder="Max"
                          min="0"
                          className="category-filter-price-input"
                        />
                      </div>
                    </div>
                  );
                }

                if (field.kind === "multi_select") {
                  const selectedSet =
                    selectedCommonMulti[field.definitionId] ?? new Set<string>();
                  const isExpanded = expandedCommonMultiIds.has(field.definitionId);
                  const visibleChoices = isExpanded
                    ? field.choices
                    : field.choices.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                  const hasMore = field.choices.length > FEATURE_OPTIONS_VISIBLE_LIMIT;
                  return (
                    <div
                      className="category-filter-section"
                      key={`common-${field.definitionId}`}
                    >
                      <h3 className="category-filter-section-title">
                        {field.name.toLocaleUpperCase("tr-TR")}
                      </h3>
                      <div className="category-filter-section-checkboxes">
                        {visibleChoices.map((c) => {
                          const key = String(c.id);
                          const isChecked = selectedSet.has(key);
                          return (
                            <label
                              key={c.id}
                              className={`category-filter-checkbox-option${
                                isChecked ? " category-filter-checkbox-option--selected" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleCommonMulti(field.definitionId, c.id)}
                                className="category-filter-checkbox-input"
                              />
                              <span className="category-filter-checkbox-label">
                                {c.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {hasMore ? (
                        <button
                          type="button"
                          className="category-filter-show-more"
                          onClick={() => toggleCommonMultiExpanded(field.definitionId)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded
                            ? "Daha Az Göster"
                            : `Daha Fazla Göster (+${field.choices.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
                        </button>
                      ) : null}
                    </div>
                  );
                }

                return null;
              })}

              {featureGroupsLoading ? (
                <div className="category-filter-section">
                  <p className="category-filter-section-empty">Filtreler yükleniyor...</p>
                </div>
              ) : featureGroupsError ? (
                <div className="category-filter-section">
                  <p className="category-filter-section-empty">{featureGroupsError}</p>
                </div>
              ) : renderedFeatureGroups.length === 0 ? null : (
                renderedFeatureGroups.map((group) => {
                  const selectedKeys = selectedFeatureOptionsByGroup[group.id] ?? new Set<string>();
                  const isExpanded = expandedGroupIds.has(group.id);
                  const optionsToShow = isExpanded
                    ? group.options
                    : group.options.slice(0, FEATURE_OPTIONS_VISIBLE_LIMIT);
                  const hasMore = group.options.length > FEATURE_OPTIONS_VISIBLE_LIMIT;

                  return (
                    <div className="category-filter-section" key={`feature-group-${group.id}`}>
                      <h3 className="category-filter-section-title">
                        {group.name.toLocaleUpperCase("tr-TR")}
                      </h3>
                      <div className="category-filter-section-checkboxes">
                        {optionsToShow.map((option) => {
                          const isChecked = selectedKeys.has(option.key);
                          return (
                            <label
                              key={option.key}
                              className={`category-filter-checkbox-option${
                                isChecked ? " category-filter-checkbox-option--selected" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleFeatureOption(group.id, option.key)}
                                className="category-filter-checkbox-input"
                              />
                              <span className="category-filter-checkbox-label">
                                {option.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {hasMore ? (
                        <button
                          type="button"
                          className="category-filter-show-more"
                          onClick={() => toggleGroupExpanded(group.id)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded
                            ? "Daha Az Göster"
                            : `Daha Fazla Göster (+${group.options.length - FEATURE_OPTIONS_VISIBLE_LIMIT})`}
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              <div className="category-filter-section">
                <h3 className="category-filter-section-title">KATEGORİLER</h3>
                <div className="category-filter-section-options">
                  {categories.map((cat) => (
                    <label
                      key={cat.value}
                      className={`category-filter-radio-option ${selectedCategory === cat.value ? 'category-filter-radio-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={selectedCategory === cat.value}
                        onChange={(e) => handleFilterChange({ category: e.target.value })}
                        className="category-filter-radio-input"
                      />
                      <span className="category-filter-radio-label">{cat.label}</span>
                      <span className="category-filter-radio-count">{cat.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="category-filter-section">
                <h3 className="category-filter-section-title">AYLIK ÜCRET</h3>
                <div className="category-filter-price-inputs">
                  <Input
                    type="number"
                    value={priceRange[0] === 0 ? "" : priceRange[0]}
                    onChange={(e) => handlePriceInput(0, e.target.value)}
                    placeholder="0"
                    min="0"
                    className="category-filter-price-input"
                  />
                  <span className="category-filter-price-separator">-</span>
                  <Input
                    type="number"
                    value={priceRange[1] === 50000 ? "" : priceRange[1]}
                    onChange={(e) => handlePriceInput(1, e.target.value)}
                    placeholder="50000"
                    min="0"
                    className="category-filter-price-input"
                  />
                </div>
              </div>
            </>
          )}

          {showLoginHint ? (
            <p className="category-filter-login-hint" role="note">
              Daha fazla filtreleme yapmak için lütfen giriş yapınız.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default function CategoryFilterSidebar({ config, onFilterChange, categorySlug }: CategoryFilterSidebarProps) {
  const ctxModel = useContext(SchoolCategoryFilterPanelContext);
  const fallbackModel = useCategoryFilterSidebarModel({
    enabled: ctxModel == null,
    config,
    onFilterChange,
    categorySlug,
  });
  const model = ctxModel ?? fallbackModel;
  return <CategoryFilterSidebarView model={model} />;
}

/**
 * Sonuç alanında, kategoriye özel paylaşımlı filtre modeli aktifken görünür
 * olan "Filtreleri Sıfırla" butonu. Tıklandığında tüm filtre state'i default
 * haline döner ve sonuçlar filtrelenmemiş şekilde listelenir.
 */
export function CategoryFilterResetButton() {
  const ctxModel = useContext(SchoolCategoryFilterPanelContext);
  if (!ctxModel) return null;
  if (!ctxModel.hasActiveFilters) return null;
  return (
    <div className="category-results-reset">
      <button
        type="button"
        className="category-results-reset-btn"
        onClick={ctxModel.resetAll}
        aria-label="Tüm filtreleri sıfırla"
      >
        <RotateCcw size={16} aria-hidden="true" />
        <span>Filtreleri Sıfırla</span>
      </button>
    </div>
  );
}
