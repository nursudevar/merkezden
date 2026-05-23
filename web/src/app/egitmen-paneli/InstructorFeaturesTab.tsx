"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Shapes } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_FEATURES_CATEGORY_REQUIRED,
  INSTRUCTOR_FEATURES_LOAD_ERROR,
  INSTRUCTOR_FEATURES_SAVE_ERROR,
  INSTRUCTOR_FEATURES_SAVE_SUCCESS,
  buildInstructorFeatureFormStateFromEntries,
  fetchInstructorFeatureCategoriesClient,
  fetchInstructorFeatureDefinitionsBundleClient,
  fetchInstructorFeatureEntriesClient,
  getDisplayInstructorFeatureName,
  isSchoolHoursInstructorFeature,
  saveInstructorFeaturesClient,
  type InstructorFeatureCategoryRow,
  type InstructorFeatureChoiceRow,
  type InstructorFeatureDefinitionRow,
  type InstructorFeatureEntryRow,
  type InstructorFeatureEntryChoiceRow,
  type InstructorFeatureFormState,
  type InstructorFeatureGroupRow,
} from "@/lib/instructorFeaturesClient";
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
};

const EMPTY_FORM: InstructorFeatureFormState = {
  booleanValues: {},
  textValues: {},
  numberValues: {},
  dateValues: {},
  singleSelectValues: {},
  multiSelectValues: {},
};

export function InstructorFeaturesTab({ authUserId, instructorRow, onInstructorRowChange }: Props) {
  const instructorId = instructorRow.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const [saveToastNonce, setSaveToastNonce] = useState(0);

  const [categories, setCategories] = useState<InstructorFeatureCategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [openCategoryPicker, setOpenCategoryPicker] = useState(false);

  const [featureGroups, setFeatureGroups] = useState<InstructorFeatureGroupRow[]>([]);
  const [featureDefinitions, setFeatureDefinitions] = useState<InstructorFeatureDefinitionRow[]>([]);
  const [featureChoices, setFeatureChoices] = useState<InstructorFeatureChoiceRow[]>([]);
  const [featureEntries, setFeatureEntries] = useState<InstructorFeatureEntryRow[]>([]);
  const [featureEntryChoices, setFeatureEntryChoices] = useState<InstructorFeatureEntryChoiceRow[]>([]);

  const [form, setForm] = useState<InstructorFeatureFormState>(EMPTY_FORM);
  const [openInstructorSelectId, setOpenInstructorSelectId] = useState<number | null>(null);

  const applyFormFromEntries = useCallback(
    (definitions: InstructorFeatureDefinitionRow[], entries: InstructorFeatureEntryRow[], entryChoices: InstructorFeatureEntryChoiceRow[]) => {
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
    setFeatureEntryChoices(entriesResult.entryChoices);

    const initialCategory =
      instructorRow.category_id != null && Number.isFinite(Number(instructorRow.category_id))
        ? String(instructorRow.category_id)
        : "";
    setCategoryId(initialCategory);
    applyFormFromEntries(bundle.definitions, entriesResult.entries, entriesResult.entryChoices);
    setLoading(false);
  }, [applyFormFromEntries, authUserId, instructorId, instructorRow.category_id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".egitmen-panel-features-single-select-dropdown")) {
        setOpenInstructorSelectId(null);
      }
      if (!target?.closest(".egitmen-panel-features-category-dropdown")) {
        setOpenCategoryPicker(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const groupsWithFeatures = useMemo((): InstructorFeatureSelectionGroup[] => {
    return featureGroups
      .map((group) => {
        const features: InstructorFeatureDefinitionForSelection[] = featureDefinitions
          .filter((f) => f.group_id === group.id)
          .filter(
            (f) =>
              f.input_type === "text" ||
              f.input_type === "number" ||
              f.input_type === "date" ||
              f.input_type === "boolean" ||
              f.input_type === "multi_select" ||
              f.input_type === "single_select",
          )
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((f) => ({
            id: f.id,
            name: f.name,
            input_type: f.input_type,
            help_text: f.help_text,
            placeholder: f.placeholder,
            unit: f.unit,
          }));
        return { group, features };
      })
      .filter((item) => item.features.length > 0);
  }, [featureDefinitions, featureGroups]);

  const selectionGroups = groupsWithFeatures;

  const baslicaOzelliklerGroup = selectionGroups.find(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === "başlıca özellikler",
  );

  const okulImkanlariIndex = selectionGroups.findIndex(
    ({ group }) => group.name.trim().toLocaleLowerCase("tr-TR") === "okul imkanları",
  );

  const upperGroups = baslicaOzelliklerGroup
    ? [baslicaOzelliklerGroup]
    : okulImkanlariIndex !== -1
      ? selectionGroups.slice(0, okulImkanlariIndex)
      : selectionGroups;

  const lowerGroupsRaw = baslicaOzelliklerGroup
    ? selectionGroups.filter((item) => item.group.id !== baslicaOzelliklerGroup.group.id)
    : okulImkanlariIndex !== -1
      ? selectionGroups.slice(okulImkanlariIndex)
      : [];

  const selectedCategorySlug = useMemo(() => {
    const id = categoryId.trim();
    if (!id) return null;
    const cat = categories.find((c) => String(c.id) === id);
    const slug = (cat?.slug ?? "").trim();
    return slug.length > 0 ? slug : null;
  }, [categories, categoryId]);

  const lowerGroups =
    selectedCategorySlug === null
      ? []
      : lowerGroupsRaw.filter(
          ({ group }) => (group.category_slug ?? "").trim() === selectedCategorySlug,
        );

  const featureIdsToSave = useMemo(() => {
    const ids = new Set<number>();
    for (const { features } of upperGroups) {
      for (const f of features) ids.add(f.id);
    }
    for (const { features } of lowerGroups) {
      for (const f of features) ids.add(f.id);
    }
    return Array.from(ids);
  }, [lowerGroups, upperGroups]);

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
    const parsedCategoryId = Number(categoryId.trim());
    if (!Number.isFinite(parsedCategoryId) || !parsedCategoryId) {
      flashSaveMessage(INSTRUCTOR_FEATURES_CATEGORY_REQUIRED);
      return;
    }

    setSaving(true);
    setSaveToastMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: saveError } = await saveInstructorFeaturesClient(
        {
          authUid: authUserId,
          instructorId,
          categoryId: parsedCategoryId,
          definitions: featureDefinitions,
          entries: featureEntries,
          form,
          featureIdsToSave,
        },
        supabase,
      );

      if (saveError) {
        flashSaveMessage(saveError);
        return;
      }

      const { data: updatedInstructor } = await supabase
        .from("instructors")
        .select("id, category_id, is_verified, owner_auth_id")
        .eq("id", instructorId)
        .eq("owner_auth_id", authUserId)
        .maybeSingle();

      if (updatedInstructor) {
        onInstructorRowChange({ ...instructorRow, ...updatedInstructor });
      } else {
        onInstructorRowChange({ ...instructorRow, category_id: parsedCategoryId });
      }

      const entriesResult = await fetchInstructorFeatureEntriesClient(authUserId, instructorId, supabase);
      if (!entriesResult.error) {
        setFeatureEntries(entriesResult.entries);
        setFeatureEntryChoices(entriesResult.entryChoices);
        applyFormFromEntries(featureDefinitions, entriesResult.entries, entriesResult.entryChoices);
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

  return (
    <>
    <div className="egitmen-panel-features-content">
      <div className="egitmen-panel-features-groups">
        <section className="egitmen-panel-features-section egitmen-panel-features-section--type-picker">
          <h4 className="egitmen-panel-features-group-title egitmen-panel-features-group-title--academic">
            <Shapes
              className="egitmen-panel-features-group-title-icon egitmen-panel-features-group-title-icon--academic"
              aria-hidden
            />
            Kategori
          </h4>
          {categories.length === 0 ? (
            <p className="egitmen-panel-features-empty-text">Aktif kategori bulunamadı.</p>
          ) : (
            <div className="egitmen-panel-features-feature-input-wrap">
              <p className="egitmen-panel-features-feature-name">Kategori</p>
              <div className="egitmen-panel-features-category-dropdown egitmen-panel-features-single-select-dropdown">
                <button
                  type="button"
                  className={`egitmen-panel-features-feature-select egitmen-panel-features-feature-select--button ${
                    openCategoryPicker ? "egitmen-panel-features-feature-select--open" : ""
                  }`}
                  onClick={() => setOpenCategoryPicker((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={openCategoryPicker}
                >
                  <span className="egitmen-panel-features-feature-select-label">
                    {categories.find((c) => String(c.id) === categoryId)?.name || "Seçiniz"}
                  </span>
                </button>
                {openCategoryPicker ? (
                  <div className="egitmen-panel-features-feature-select-menu" role="listbox">
                    <button
                      type="button"
                      role="option"
                      className={`egitmen-panel-features-feature-select-option ${
                        categoryId === "" ? "egitmen-panel-features-feature-select-option--selected" : ""
                      }`}
                      onClick={() => {
                        setCategoryId("");
                        setOpenCategoryPicker(false);
                      }}
                    >
                      Seçiniz
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        className={`egitmen-panel-features-feature-select-option ${
                          categoryId === String(c.id)
                            ? "egitmen-panel-features-feature-select-option--selected"
                            : ""
                        }`}
                        onClick={() => {
                          setCategoryId(String(c.id));
                          setOpenCategoryPicker(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <InstructorFeatureSelectionGroupList
          groups={upperGroups}
          getDisplayFeatureName={getDisplayInstructorFeatureName}
          instructorTextFeatureValues={form.textValues}
          setInstructorTextFeatureValues={setText}
          instructorNumberFeatureValues={form.numberValues}
          setInstructorNumberFeatureValues={setNumber}
          instructorDateFeatureValues={form.dateValues}
          setInstructorDateFeatureValues={setDate}
          instructorBooleanFeatureValues={form.booleanValues}
          setInstructorBooleanFeatureValues={setBoolean}
          instructorSingleSelectValues={form.singleSelectValues}
          setInstructorSingleSelectValues={setSingle}
          instructorMultiSelectValues={form.multiSelectValues}
          setInstructorMultiSelectValues={setMulti}
          instructorFeatureChoices={featureChoices}
          openInstructorSelectId={openInstructorSelectId}
          setOpenInstructorSelectId={setOpenInstructorSelectId}
        />

        {lowerGroups.length > 0 ? (
          <InstructorFeatureSelectionGroupList
            groups={lowerGroups}
            getDisplayFeatureName={getDisplayInstructorFeatureName}
            instructorTextFeatureValues={form.textValues}
            setInstructorTextFeatureValues={setText}
            instructorNumberFeatureValues={form.numberValues}
            setInstructorNumberFeatureValues={setNumber}
            instructorDateFeatureValues={form.dateValues}
            setInstructorDateFeatureValues={setDate}
            instructorBooleanFeatureValues={form.booleanValues}
            setInstructorBooleanFeatureValues={setBoolean}
            instructorSingleSelectValues={form.singleSelectValues}
            setInstructorSingleSelectValues={setSingle}
            instructorMultiSelectValues={form.multiSelectValues}
            setInstructorMultiSelectValues={setMulti}
            instructorFeatureChoices={featureChoices}
            openInstructorSelectId={openInstructorSelectId}
            setOpenInstructorSelectId={setOpenInstructorSelectId}
          />
        ) : null}

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
      </div>
    </div>

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
}
