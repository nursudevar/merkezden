"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { SavingOverlay } from "@/components/SavingOverlay";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MAX_INSTITUTION_EXTRA_BRANCHES,
  fetchExtraBranchBooleanDefinitionsForSlugClient,
  fetchSupportedExtraBranchCategoriesClient,
  loadInstitutionExtraBranchesClient,
  saveInstitutionExtraBranchesClient,
  type InstitutionExtraBranchBooleanDefinition,
  type InstitutionExtraBranchCategory,
} from "@/lib/institutionExtraBranches";

export const INSTITUTION_EXTRA_BRANCHES_SECTION_ID = "institution-extra-branches-section";

export type InstitutionExtraBranchesSectionHandle = {
  scrollIntoView: () => void;
  addBranch: () => boolean;
  canAddBranch: () => boolean;
  resetUiState: () => void;
};

type InstitutionExtraBranchesSectionProps = {
  institutionId: string;
  mainCategoryId: string | null;
  onSlotCountChange?: (count: number) => void;
};

type UiExtraBranchSlot = {
  clientKey: string;
  categoryId: number | null;
  categorySlug: string;
  categoryName: string;
  groupName: string;
  definitions: InstitutionExtraBranchBooleanDefinition[];
  definitionsLoading: boolean;
};

type SlotValidationError = {
  category?: string;
  types?: string;
};

function buildSnapshotKey(
  slots: UiExtraBranchSlot[],
  booleanValues: Record<number, boolean>,
): string {
  return slots
    .map((slot, index) => {
      if (!slot.categoryId) {
        return `${index}:empty`;
      }
      const slug = slot.categorySlug.trim().toLowerCase();
      const selectedDefinitionIds = slot.definitions
        .filter((definition) => booleanValues[definition.id] === true)
        .map((definition) => definition.id)
        .sort((a, b) => a - b);
      return `${index}:${slot.categoryId}:${slug}:${selectedDefinitionIds.join(",")}`;
    })
    .join("|");
}

function createEmptySlot(): UiExtraBranchSlot {
  return {
    clientKey: `extra-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoryId: null,
    categorySlug: "",
    categoryName: "",
    groupName: "",
    definitions: [],
    definitionsLoading: false,
  };
}

function slotHasTypeSelection(
  slot: UiExtraBranchSlot,
  booleanValues: Record<number, boolean>,
): boolean {
  return slot.definitions.some((definition) => booleanValues[definition.id] === true);
}

function validateSlot(
  slot: UiExtraBranchSlot,
  booleanValues: Record<number, boolean>,
): SlotValidationError | null {
  if (!slot.categoryId) {
    return { category: "Lütfen kategori seçin." };
  }
  if (slot.definitionsLoading) {
    return { types: "Türler yükleniyor…" };
  }
  if (slot.definitions.length === 0) {
    return { types: "En az bir branş seçmelisiniz." };
  }
  if (!slotHasTypeSelection(slot, booleanValues)) {
    return { types: "En az bir branş seçmelisiniz." };
  }
  return null;
}

function resolveMainCategoryId(mainCategoryId: string | null): number | null {
  const parsed = Number(mainCategoryId);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const InstitutionExtraBranchesSection = forwardRef<
  InstitutionExtraBranchesSectionHandle,
  InstitutionExtraBranchesSectionProps
>(function InstitutionExtraBranchesSection(
  { institutionId, mainCategoryId, onSlotCountChange },
  ref,
) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sectionRef = useRef<HTMLElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [slotErrors, setSlotErrors] = useState<Record<string, SlotValidationError>>({});

  const [supportedCategories, setSupportedCategories] = useState<InstitutionExtraBranchCategory[]>([]);
  const [uiSlots, setUiSlots] = useState<UiExtraBranchSlot[]>([]);
  const [booleanValues, setBooleanValues] = useState<Record<number, boolean>>({});
  const [loadedCategoryIds, setLoadedCategoryIds] = useState<number[]>([]);
  const [savedSnapshotKey, setSavedSnapshotKey] = useState("");
  const [openCategoryPickerKey, setOpenCategoryPickerKey] = useState<string | null>(null);

  const normalizedInstitutionId = Number(institutionId);
  const savedCategoryCount = loadedCategoryIds.length;
  const canAddMore = uiSlots.length < MAX_INSTITUTION_EXTRA_BRANCHES;
  const showSaveButton = uiSlots.length > 0 || savedCategoryCount > 0;
  const currentSnapshotKey = useMemo(
    () => buildSnapshotKey(uiSlots, booleanValues),
    [uiSlots, booleanValues],
  );
  const isDirty = currentSnapshotKey !== savedSnapshotKey;

  const reloadSupportedCategories = useCallback(
    async (mainId: number | null) => {
      const categories = await fetchSupportedExtraBranchCategoriesClient(supabase, {
        mainCategoryId: mainId,
      });
      setSupportedCategories(categories);
    },
    [supabase],
  );

  const loadExtraBranches = useCallback(async () => {
    if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setSaveMessage(null);
    setSaveError(null);
    setSlotErrors({});

    try {
      const mainId = resolveMainCategoryId(mainCategoryId);

      const [categories, loaded] = await Promise.all([
        fetchSupportedExtraBranchCategoriesClient(supabase, { mainCategoryId: mainId }),
        loadInstitutionExtraBranchesClient(supabase, normalizedInstitutionId),
      ]);

      const filteredSlots = loaded.slots.filter(
        (slot) => mainId == null || slot.categoryId !== mainId,
      );

      const nextSlots =
        filteredSlots.length > 0
          ? filteredSlots.map((slot) => ({
              clientKey: `extra-${slot.categoryId}`,
              categoryId: slot.categoryId,
              categorySlug: slot.category.slug,
              categoryName: slot.category.name,
              groupName: slot.groupName,
              definitions: slot.definitions,
              definitionsLoading: false,
            }))
          : [];

      setSupportedCategories(categories);
      setBooleanValues(loaded.booleanValues);
      setLoadedCategoryIds(filteredSlots.map((slot) => slot.categoryId));
      setUiSlots(nextSlots);
      setSavedSnapshotKey(buildSnapshotKey(nextSlots, loaded.booleanValues));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ek branşlar yüklenirken bir hata oluştu.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [normalizedInstitutionId, supabase, mainCategoryId]);

  useEffect(() => {
    void loadExtraBranches();
    // Kategori değişiminde DB'den yeniden yükleme yapılmaz; resetUiState ile UI sıfırlanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca kurum değişince
  }, [normalizedInstitutionId, supabase]);

  const resetUiState = useCallback(() => {
    setUiSlots([]);
    setBooleanValues({});
    setLoadedCategoryIds([]);
    setSavedSnapshotKey(buildSnapshotKey([], {}));
    setSlotErrors({});
    setSaveMessage(null);
    setSaveError(null);
  }, []);

  useEffect(() => {
    const mainStr = String(mainCategoryId ?? "").trim();
    const mainId = Number(mainStr);

    if (!Number.isFinite(mainId) || mainId <= 0) {
      void reloadSupportedCategories(null);
      return;
    }

    void reloadSupportedCategories(mainId);

    setUiSlots((prevSlots) =>
      prevSlots.filter((slot) => slot.categoryId == null || slot.categoryId !== mainId),
    );
  }, [mainCategoryId, reloadSupportedCategories]);

  const getAvailableCategoriesForSlot = useCallback(
    (slotKey: string) => {
      const selectedElsewhere = new Set(
        uiSlots
          .filter((slot) => slot.clientKey !== slotKey && slot.categoryId != null)
          .map((slot) => slot.categoryId as number),
      );
      return supportedCategories.filter((category) => !selectedElsewhere.has(category.id));
    },
    [supportedCategories, uiSlots],
  );

  const handleAddSlot = useCallback(() => {
    if (uiSlots.length >= MAX_INSTITUTION_EXTRA_BRANCHES) return false;
    setUiSlots((prev) => [...prev, createEmptySlot()]);
    setSaveMessage(null);
    setSaveError(null);
    setSlotErrors({});
    return true;
  }, [uiSlots.length]);

  useEffect(() => {
    onSlotCountChange?.(uiSlots.length);
  }, [onSlotCountChange, uiSlots.length]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  useImperativeHandle(
    ref,
    () => ({
      scrollIntoView: () => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      addBranch: () => handleAddSlot(),
      canAddBranch: () => uiSlots.length < MAX_INSTITUTION_EXTRA_BRANCHES,
      resetUiState,
    }),
    [handleAddSlot, resetUiState, uiSlots.length],
  );

  const clearSlotError = (clientKey: string, field: keyof SlotValidationError) => {
    setSlotErrors((prev) => {
      const current = prev[clientKey];
      if (!current?.[field]) return prev;
      const next = { ...current };
      delete next[field];
      const updated = { ...prev };
      if (Object.keys(next).length === 0) {
        delete updated[clientKey];
      } else {
        updated[clientKey] = next;
      }
      return updated;
    });
  };

  const handleRemoveSlot = (clientKey: string) => {
    setUiSlots((prev) => prev.filter((slot) => slot.clientKey !== clientKey));
    setOpenCategoryPickerKey((prev) => (prev === clientKey ? null : prev));
    setSaveMessage(null);
    setSaveError(null);
    setSlotErrors((prev) => {
      if (!prev[clientKey]) return prev;
      const next = { ...prev };
      delete next[clientKey];
      return next;
    });
  };

  const handleSelectCategory = async (
    clientKey: string,
    category: InstitutionExtraBranchCategory,
  ) => {
    setOpenCategoryPickerKey(null);
    clearSlotError(clientKey, "category");
    setSaveMessage(null);
    setSaveError(null);

    setUiSlots((prev) =>
      prev.map((slot) =>
        slot.clientKey === clientKey
          ? {
              ...slot,
              categoryId: category.id,
              categorySlug: category.slug,
              categoryName: category.name,
              groupName: "",
              definitions: [],
              definitionsLoading: true,
            }
          : slot,
      ),
    );

    try {
      const { groupName, definitions } = await fetchExtraBranchBooleanDefinitionsForSlugClient(
        supabase,
        category.slug,
      );
      setUiSlots((prev) =>
        prev.map((slot) =>
          slot.clientKey === clientKey
            ? { ...slot, groupName, definitions, definitionsLoading: false }
            : slot,
        ),
      );
    } catch {
      setUiSlots((prev) =>
        prev.map((slot) =>
          slot.clientKey === clientKey
            ? {
                ...slot,
                categoryId: null,
                categorySlug: "",
                categoryName: "",
                groupName: "",
                definitions: [],
                definitionsLoading: false,
              }
            : slot,
        ),
      );
      setSaveError("Kategori türleri yüklenemedi. Lütfen tekrar deneyin.");
    }
  };

  const handleToggleBoolean = (clientKey: string, definitionId: number, checked: boolean) => {
    setBooleanValues((prev) => ({ ...prev, [definitionId]: checked }));
    if (checked) {
      clearSlotError(clientKey, "types");
    }
    setSaveMessage(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!Number.isFinite(normalizedInstitutionId) || normalizedInstitutionId <= 0) return;
    if (!isDirty) return;

    setSaveMessage(null);
    setSaveError(null);

    if (uiSlots.length === 0) {
      if (loadedCategoryIds.length === 0) return;

      setSaving(true);
      try {
        await saveInstitutionExtraBranchesClient(
          supabase,
          normalizedInstitutionId,
          [],
          {},
          {
            mainCategoryId: resolveMainCategoryId(mainCategoryId),
            previousCategoryIds: loadedCategoryIds,
          },
        );
        setLoadedCategoryIds([]);
        setSlotErrors({});
        setSavedSnapshotKey("");
        setSaveMessage("Ek branşlar kaydedildi.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Ek branşlar kaydedilirken bir hata oluştu.";
        setSaveError(message);
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextSlotErrors: Record<string, SlotValidationError> = {};
    for (const slot of uiSlots) {
      const error = validateSlot(slot, booleanValues);
      if (error) {
        nextSlotErrors[slot.clientKey] = error;
      }
    }

    if (Object.keys(nextSlotErrors).length > 0) {
      setSlotErrors(nextSlotErrors);
      setSaveError("Lütfen tüm ek branş alanlarını kontrol edin.");
      return;
    }

    const slotsToSave = uiSlots.map((slot) => ({ categoryId: slot.categoryId as number }));
    const booleanValuesByCategorySlug: Record<string, Record<number, boolean>> = {};

    for (const slot of uiSlots) {
      if (!slot.categorySlug) continue;
      booleanValuesByCategorySlug[slot.categorySlug] = {};
      for (const definition of slot.definitions) {
        booleanValuesByCategorySlug[slot.categorySlug][definition.id] = Boolean(
          booleanValues[definition.id],
        );
      }
    }

    setSaving(true);
    setSlotErrors({});

    try {
      await saveInstitutionExtraBranchesClient(
        supabase,
        normalizedInstitutionId,
        slotsToSave,
        booleanValuesByCategorySlug,
        {
          mainCategoryId: resolveMainCategoryId(mainCategoryId),
          previousCategoryIds: loadedCategoryIds,
        },
      );

      const nextUiSlots = uiSlots.map((slot) =>
        slot.categoryId != null ? { ...slot, clientKey: `extra-${slot.categoryId}` } : slot,
      );

      setLoadedCategoryIds(slotsToSave.map((slot) => slot.categoryId));
      setUiSlots(nextUiSlots);
      setSavedSnapshotKey(buildSnapshotKey(nextUiSlots, booleanValues));
      setSaveMessage("Ek branşlar kaydedildi.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ek branşlar kaydedilirken bir hata oluştu.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const renderAddButton = () =>
    canAddMore ? (
      <button
        type="button"
        className="panel-institutions-extra-branches-add-btn"
        onClick={() => {
          handleAddSlot();
        }}
        disabled={loading || saving}
      >
        <Plus className="panel-institutions-extra-branches-add-btn-icon" aria-hidden />
        Ek Branş Ekle
      </button>
    ) : null;

  return (
    <section
      ref={sectionRef}
      id={INSTITUTION_EXTRA_BRANCHES_SECTION_ID}
      className="panel-main-card panel-institutions-extra-branches-anchor"
      aria-label="Ek Branşlar"
    >
      <div className="panel-institutions-content">
        <section className="panel-institutions-section panel-institutions-extra-branches">
          <h4 className="panel-institutions-section-title">Ek Branşlar</h4>
          <p className="panel-institutions-extra-branches-desc">
            Ana kategoriniz dışında hizmet verdiğiniz alanları ekleyebilirsiniz.
          </p>

          {loading ? (
            <p className="panel-institutions-empty-text">Ek branşlar yükleniyor…</p>
          ) : loadError ? (
            <p className="panel-institution-form-error" role="alert">
              {loadError}
            </p>
          ) : (
            <>
              {uiSlots.length > 0 ? (
                <div className="panel-institutions-extra-branches-list">
                  {uiSlots.map((slot, index) => {
                    const availableCategories = getAvailableCategoriesForSlot(slot.clientKey);
                    const isPickerOpen = openCategoryPickerKey === slot.clientKey;
                    const errors = slotErrors[slot.clientKey];

                    return (
                      <article
                        key={slot.clientKey}
                        className="panel-institutions-extra-branches-block"
                      >
                        <div className="panel-institutions-extra-branches-block-header">
                          <h5 className="panel-institutions-extra-branches-block-title">
                            Ek Branş {index + 1}
                          </h5>
                          <button
                            type="button"
                            className="panel-institutions-extra-branches-remove-btn"
                            onClick={() => handleRemoveSlot(slot.clientKey)}
                            disabled={saving}
                          >
                            Branşı Kaldır
                          </button>
                        </div>

                        <div className="panel-institutions-type-picker-row panel-institutions-extra-branches-picker-row">
                          <div className="panel-institutions-feature-input-wrap panel-institutions-extra-branches-category-wrap">
                            <p className="panel-institutions-feature-name">Kategori</p>
                            <div className="panel-institutions-single-select-dropdown">
                              <button
                                type="button"
                                className={`panel-institutions-feature-select panel-institutions-feature-select--button${
                                  isPickerOpen ? " panel-institutions-feature-select--open" : ""
                                }`}
                                onClick={() =>
                                  setOpenCategoryPickerKey((prev) =>
                                    prev === slot.clientKey ? null : slot.clientKey,
                                  )
                                }
                                aria-haspopup="listbox"
                                aria-expanded={isPickerOpen}
                                disabled={saving}
                              >
                                <span
                                  className="panel-institutions-feature-select-label"
                                  title={slot.categoryName || "Kategori seçiniz"}
                                >
                                  {slot.categoryName || "Kategori seçiniz"}
                                </span>
                              </button>
                              {isPickerOpen ? (
                                <div
                                  className="panel-institutions-feature-select-menu"
                                  role="listbox"
                                >
                                  {availableCategories.length === 0 ? (
                                    <p className="panel-institutions-empty-text panel-institutions-extra-branches-menu-empty">
                                      Seçilebilir kategori kalmadı.
                                    </p>
                                  ) : (
                                    availableCategories.map((category) => (
                                      <button
                                        key={category.id}
                                        type="button"
                                        role="option"
                                        aria-selected={slot.categoryId === category.id}
                                        className={`panel-institutions-feature-select-option ${
                                          slot.categoryId === category.id
                                            ? "panel-institutions-feature-select-option--selected"
                                            : ""
                                        }`}
                                        onClick={() =>
                                          void handleSelectCategory(slot.clientKey, category)
                                        }
                                      >
                                        {category.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {errors?.category ? (
                              <p className="panel-institution-form-error" role="alert">
                                {errors.category}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {slot.definitionsLoading ? (
                          <p className="panel-institutions-empty-text">Türler yükleniyor…</p>
                        ) : slot.categoryId && slot.groupName ? (
                          <div className="panel-institutions-extra-branches-types">
                            <p className="panel-institutions-group-title panel-institutions-extra-branches-types-title">
                              {slot.groupName}
                            </p>
                            {slot.definitions.length === 0 ? (
                              <p className="panel-institutions-empty-text">
                                Bu kategori için tanımlı tür bulunamadı.
                              </p>
                            ) : (
                              <div className="panel-institutions-features-grid panel-institutions-features-grid--selection panel-institutions-features-grid--extra-branches">
                                {[...slot.definitions]
                                  .sort((a, b) =>
                                    a.name.localeCompare(b.name, "tr", { sensitivity: "base" }),
                                  )
                                  .map((definition) => (
                                  <div
                                    key={definition.id}
                                    className="panel-institutions-selection-item"
                                  >
                                    <label className="panel-institutions-selection-check">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(booleanValues[definition.id])}
                                        onChange={(event) =>
                                          handleToggleBoolean(
                                            slot.clientKey,
                                            definition.id,
                                            event.target.checked,
                                          )
                                        }
                                        disabled={saving}
                                      />
                                      <span>{definition.name}</span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                            {errors?.types ? (
                              <p className="panel-institution-form-error" role="alert">
                                {errors.types}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}

              <div className="panel-institutions-extra-branches-footer">
                {renderAddButton()}
                <span className="panel-institutions-extra-branches-count">
                  {savedCategoryCount} / {MAX_INSTITUTION_EXTRA_BRANCHES} kategori eklendi
                </span>
              </div>

              <p className="panel-institutions-extra-branches-limit">
                En fazla {MAX_INSTITUTION_EXTRA_BRANCHES} farklı kategori ekleyebilirsiniz.
              </p>

              {showSaveButton ? (
                <div className="panel-institutions-actions">
                  <Button
                    type="button"
                    variant="default"
                    className="panel-institutions-save-btn"
                    onClick={() => void handleSave()}
                    disabled={loading || saving || Boolean(loadError) || !isDirty}
                  >
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                </div>
              ) : null}

              {saveError ? (
                <p className="panel-institution-form-error" role="alert">
                  {saveError}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <SavingOverlay visible={saving} text="Kaydediliyor" />

      {saveMessage ? (
        <div className="panel-features-save-toast-overlay" role="presentation">
          <div
            className="panel-features-save-toast-modal"
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-describedby="panel-extra-branches-save-toast-desc"
          >
            <p id="panel-extra-branches-save-toast-desc" className="panel-features-save-toast-text">
              {saveMessage}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
});
