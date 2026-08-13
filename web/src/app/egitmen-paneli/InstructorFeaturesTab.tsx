"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Shapes } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_FEATURES_LOAD_ERROR,
  INSTRUCTOR_FEATURES_SAVE_SUCCESS,
  buildInstructorFeatureFormStateFromEntries,
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorFeatureDefinitionsBundleClient,
  fetchInstructorFeatureEntriesClient,
  getDisplayInstructorFeatureName,
  isInstructorBaslicaFeatureGroupName,
  isInstructorPanelHiddenFeature,
  resolveInstructorCategoryDisplayName,
  resolveInstructorCategorySlug,
  resolveInstructorFeatureGroupsForActiveCategory,
  saveInstructorFeaturesClient,
  validateInstructorFeatureForm,
  type InstructorFeatureCategoryRow,
  type InstructorFeatureChoiceRow,
  type InstructorFeatureDefinitionRow,
  type InstructorFeatureEntryRow,
  type InstructorFeatureFormState,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
import {
  findStudentAgeRangeDefinitions,
  isInstructorPanelStudentAgeCategorySlug,
  isLegacyStudentAgeMultiSelectFeature,
  isStudentAgeRangeNumberFeature,
} from "@/lib/studentAgeRangeFeature";
import { SavingOverlay } from "@/components/SavingOverlay";
import { Button } from "@/components/ui";
import {
  InstructorFeatureSelectionGroupList,
  type InstructorFeatureDefinitionForSelection,
  type InstructorFeatureSelectionGroup,
} from "./InstructorFeatureSelectionGroupList";

type Props = {
  authUserId: string;
  instructorRow: InstructorProfileRow;
  onInstructorRowChange: (row: InstructorProfileRow) => void;
  splitLayout?: boolean;
  header?: ReactNode;
};

const EMPTY_FORM: InstructorFeatureFormState = {
  booleanValues: {},
  textValues: {},
  numberValues: {},
  dateValues: {},
  singleSelectValues: {},
  multiSelectValues: {},
};

const SUPPORTED_INPUT_TYPES = new Set([
  "text",
  "number",
  "date",
  "boolean",
  "multi_select",
  "single_select",
]);

export function InstructorFeaturesTab({
  authUserId,
  instructorRow,
  onInstructorRowChange,
  splitLayout = false,
  header = null,
}: Props) {
  const instructorId = Number(instructorRow.id);
  const hasValidInstructorId = Number.isFinite(instructorId) && instructorId > 0;
  const canEditInstructorCategory = instructorRow.can_edit_category === true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [saveToastNonce, setSaveToastNonce] = useState(0);
  const [studentAgeRangeError, setStudentAgeRangeError] = useState<string | null>(null);

  const [categories, setCategories] = useState<InstructorFeatureCategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [openInstructorCategoryPicker, setOpenInstructorCategoryPicker] = useState(false);
  const [featureGroups, setFeatureGroups] = useState<InstructorFeatureGroupRow[]>([]);
  const [featureDefinitions, setFeatureDefinitions] = useState<InstructorFeatureDefinitionRow[]>([]);
  const [featureChoices, setFeatureChoices] = useState<InstructorFeatureChoiceRow[]>([]);
  const [featureEntries, setFeatureEntries] = useState<InstructorFeatureEntryRow[]>([]);

  const [form, setForm] = useState<InstructorFeatureFormState>(EMPTY_FORM);
  const [openInstructorSelectId, setOpenInstructorSelectId] = useState<number | null>(null);

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
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const [{ categories: cats, error: catError }, bundle, entriesResult] = await Promise.all([
      fetchInstructorFeatureCategoriesClient(supabase),
      fetchInstructorFeatureDefinitionsBundleClient(supabase),
      fetchInstructorFeatureEntriesClient(authUserId, instructorId, supabase),
    ]);

    if (catError || bundle.error || entriesResult.error) {
      setLoadError(catError ?? bundle.error ?? entriesResult.error ?? INSTRUCTOR_FEATURES_LOAD_ERROR);
      setLoading(false);
      return;
    }

    setCategories(cats);
    setFeatureGroups(bundle.groups);
    setFeatureDefinitions(bundle.definitions);
    setFeatureChoices(bundle.choices);
    setFeatureEntries(entriesResult.entries);

    const initialCategory =
      instructorRow.category_id != null && Number.isFinite(Number(instructorRow.category_id))
        ? String(instructorRow.category_id)
        : "";
    setCategoryId(initialCategory);

    applyFormFromEntries(
      bundle.definitions,
      entriesResult.entries,
      entriesResult.entryChoices,
    );
    setLoading(false);
  }, [applyFormFromEntries, authUserId, hasValidInstructorId, instructorId, instructorRow.category_id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (instructorRow.category_id != null && Number.isFinite(Number(instructorRow.category_id))) {
      setCategoryId(String(instructorRow.category_id));
    }
  }, [instructorRow.category_id]);

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

  const instructorCategorySlug = useMemo(() => {
    const parsedId = Number(String(categoryId ?? "").trim());
    const effectiveCategoryId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : instructorRow.category_id;
    return resolveInstructorCategorySlug(effectiveCategoryId, categories);
  }, [categories, categoryId, instructorRow.category_id]);

  const categoryDisplayName = useMemo(() => {
    const parsedId = Number(String(categoryId ?? "").trim());
    const effectiveCategoryId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : instructorRow.category_id;
    return resolveInstructorCategoryDisplayName(effectiveCategoryId, categories);
  }, [categories, categoryId, instructorRow.category_id]);

  const groupsWithFeatures = useMemo((): InstructorFeatureSelectionGroup[] => {
    const showStudentAge = isInstructorPanelStudentAgeCategorySlug(instructorCategorySlug);

    return resolveInstructorFeatureGroupsForActiveCategory(featureGroups, instructorCategorySlug)
      .map((group) => {
        const features: InstructorFeatureDefinitionForSelection[] = featureDefinitions
          .filter((f) => f.group_id === group.id)
          .filter((f) => SUPPORTED_INPUT_TYPES.has(f.input_type))
          .filter((f) => !isInstructorPanelHiddenFeature(f))
          .filter((f) => !isLegacyStudentAgeMultiSelectFeature(f))
          .filter((f) => showStudentAge || !isStudentAgeRangeNumberFeature(f))
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((f) => ({
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
            category_slug: group.category_slug,
            display_order: group.display_order,
          },
          features,
        };
      })
      .filter((item) => item.features.length > 0)
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
  const lowerGroups = groupsWithFeatures.filter(({ group }) => {
    const hasCategorySlug = Boolean((group.category_slug ?? "").trim());
    if (!hasCategorySlug) return false;
    return !isInstructorBaslicaFeatureGroupName(group.name);
  });

  const featureIdsToSave = useMemo(() => {
    const ids = new Set<number>();
    for (const { features } of groupsWithFeatures) {
      for (const f of features) ids.add(f.id);
    }
    return Array.from(ids);
  }, [groupsWithFeatures]);

  /** Gizli kategorilerde Öğrenci Yaşı entry'lerini silme — yalnızca UI görünürlüğü değişir. */
  const protectedStudentAgeDefinitionIds = useMemo(() => {
    if (isInstructorPanelStudentAgeCategorySlug(instructorCategorySlug)) return [] as number[];
    const ageDefs = findStudentAgeRangeDefinitions(featureDefinitions);
    const ids: number[] = [];
    if (ageDefs.min) ids.push(ageDefs.min.id);
    if (ageDefs.max) ids.push(ageDefs.max.id);
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

    try {
      const supabase = createSupabaseBrowserClient();
      const parsedCategoryId = Number(String(categoryId ?? "").trim());
      const categoryIdToSave =
        canEditInstructorCategory && Number.isFinite(parsedCategoryId) && parsedCategoryId > 0
          ? parsedCategoryId
          : undefined;
      const { error: saveError } = await saveInstructorFeaturesClient(
        {
          authUid: authUserId,
          instructorId,
          definitions: featureDefinitions,
          choices: featureChoices,
          entries: featureEntries,
          form,
          featureIdsToSave,
          categoryIdToSave,
          protectedDefinitionIds: protectedStudentAgeDefinitionIds,
        },
        supabase,
      );

      if (saveError) {
        flashSaveMessage(saveError);
        return;
      }

      const { data: updatedInstructor } = await supabase
        .from("instructors")
        .select(
          "id, category_id, can_edit_category, is_approved, owner_auth_id, lesson_type, service_type, education_level, working_hours_start, working_hours_end",
        )
        .eq("id", instructorId)
        .eq("owner_auth_id", authUserId)
        .maybeSingle();

      if (updatedInstructor) {
        onInstructorRowChange({ ...instructorRow, ...updatedInstructor });
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

  if (groupsWithFeatures.length === 0) {
    return (
      <div className="egitmen-panel-features-empty">
        <p className="egitmen-panel-features-empty-text">Aktif özellik grubu bulunamadı.</p>
      </div>
    );
  }

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
        <div
          className={`egitmen-panel-features-category-dropdown egitmen-panel-features-single-select-dropdown${
            canEditInstructorCategory ? "" : " egitmen-panel-features-type-picker-disabled"
          }`}
        >
          <button
            type="button"
            className={`egitmen-panel-features-feature-select egitmen-panel-features-feature-select--button${
              openInstructorCategoryPicker ? " egitmen-panel-features-feature-select--open" : ""
            }`}
            disabled={!canEditInstructorCategory}
            aria-disabled={!canEditInstructorCategory}
            onClick={() => {
              if (!canEditInstructorCategory) return;
              setOpenInstructorCategoryPicker((prev) => !prev);
              setOpenInstructorSelectId(null);
            }}
            aria-haspopup={canEditInstructorCategory ? "listbox" : undefined}
            aria-expanded={canEditInstructorCategory ? openInstructorCategoryPicker : undefined}
          >
            <span className="egitmen-panel-features-feature-select-label">{categoryDisplayName}</span>
          </button>
          {canEditInstructorCategory && openInstructorCategoryPicker ? (
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
                    const nextCategoryId = String(category.id);
                    setOpenInstructorCategoryPicker(false);
                    if (nextCategoryId === categoryId) return;
                    setCategoryId(nextCategoryId);
                    setForm(EMPTY_FORM);
                    setOpenInstructorSelectId(null);
                    setStudentAgeRangeError(null);
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="egitmen-panel-features-category-note">
          {canEditInstructorCategory
            ? "Bu hesap için kategori değişikliği geçici olarak açılmıştır."
            : "Kategori kayıt sırasında belirlenir ve sonradan değiştirilemez."}
        </p>
      </div>
    </section>
  );

  const upperContent = (
    <div className="egitmen-panel-features-content">
      <div className="egitmen-panel-features-groups">
        {categorySection}
        <InstructorFeatureSelectionGroupList groups={upperGroups} {...selectionListProps} />
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
    </>
  );

  if (splitLayout) {
    return (
      <>
        <div className="egitmen-panel-page-main">
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
        {overlays}
      </>
    );
  }

  return (
    <>
      <div className="egitmen-panel-features-content">
        <div className="egitmen-panel-features-groups">
          {categorySection}
          <InstructorFeatureSelectionGroupList groups={upperGroups} {...selectionListProps} />
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
