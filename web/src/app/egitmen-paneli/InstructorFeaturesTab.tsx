"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Shapes } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_FEATURES_CATEGORY_REQUIRED,
  INSTRUCTOR_FEATURES_LOAD_ERROR,
  INSTRUCTOR_FEATURES_SAVE_SUCCESS,
  buildInstructorFeatureFormStateFromEntries,
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorFeatureDefinitionsBundleClient,
  fetchInstructorFeatureEntriesClient,
  fetchInstructorOwnedCategoryIdClient,
  getDisplayInstructorFeatureName,
  isInstructorBaslicaFeatureGroupName,
  isInstructorPanelHiddenFeature,
  parseInstructorCategoryId,
  resolveInstructorCategoryDisplayName,
  resolveInstructorCategorySlug,
  resolveInstructorFeatureGroupsForActiveCategory,
  saveInstructorFeaturesClient,
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
  leadingSlot?: ReactNode;
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
  leadingSlot = null,
}: Props) {
  const instructorId = Number(instructorRow.id);
  const hasValidInstructorId = Number.isFinite(instructorId) && instructorId > 0;

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
      const categoryIdToSave = parseInstructorCategoryId(categoryId);
      if (categoryIdToSave == null) {
        flashSaveMessage(INSTRUCTOR_FEATURES_CATEGORY_REQUIRED);
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
          "id, category_id, is_approved, owner_auth_id, lesson_type, service_type, education_level, working_hours_start, working_hours_end",
        )
        .eq("id", instructorId)
        .eq("owner_auth_id", authUserId)
        .maybeSingle();

      if (updatedInstructor) {
        const savedCategoryId = parseInstructorCategoryId(
          (updatedInstructor as { category_id?: number | null }).category_id,
        );
        setCategoryId(savedCategoryId != null ? String(savedCategoryId) : "");
        onInstructorRowChange({ ...instructorRow, ...updatedInstructor });
      } else {
        setCategoryId(String(categoryIdToSave));
        onInstructorRowChange({ ...instructorRow, category_id: categoryIdToSave });
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
                    const nextCategoryId = String(category.id);
                    setOpenInstructorCategoryPicker(false);
                    if (nextCategoryId === categoryId) return;
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
