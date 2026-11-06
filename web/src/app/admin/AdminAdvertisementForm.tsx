"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ImagePlus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countPlacementOccupancy,
  getAdvertisementMediaPublicUrl,
  saveAdvertisement,
  searchAdvertiserInstitutions,
  searchAdvertiserInstructors,
  type AdPlacementRecord,
  type AdPlacementType,
  type AdvertisementButton,
  type AdvertisementMediaType,
  type AdvertisementRecord,
  type AdvertiserOption,
  type AdvertiserType,
} from "@/lib/advertisementsClient";
import {
  uploadAdvertisementMedia,
  validateAdvertisementMediaFile,
  validateAdvertisementMediaOrientation,
} from "@/lib/advertisementsMediaClient";

type PlacementDraft = { selected: boolean; startsAt: string; endsAt: string };
type ButtonDraft = { label: string; url: string };
type ButtonFieldError = { label?: string; url?: string };

const BUTTON_LABEL_MAX = 60;
const BUTTON_URL_MAX = 2048;
const PLACEMENT_CAPACITY = 10;

const CHOICES: Array<{ value: AdvertiserType; label: string }> = [
  { value: "platform", label: "Merkezden" },
  { value: "institution", label: "Kurum" },
  { value: "instructor", label: "Eğitmen" },
];

const WEEKDAY_LABELS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"] as const;
const MONTH_NAME_FMT = new Intl.DateTimeFormat("tr-TR", { month: "long" });

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function placementName(placement: AdPlacementRecord): string {
  if (placement.placementType === "home") return "Ana Sayfa Banner";
  if (placement.placementType === "instructor_general") return "Eğitmenler Genel";
  if (placement.placementType === "institution_category") {
    return placement.institutionCategoryName || placement.placementKey;
  }
  return placement.instructorCategoryName || placement.placementKey;
}

function groupLabel(type: AdPlacementType): string {
  if (type === "home") return "Ana Sayfa";
  if (type === "institution_category") return "Kurum Kategorileri";
  if (type === "instructor_general" || type === "instructor_category") return "Eğitmenler";
  return "Yayın alanları";
}

function groupOrder(label: string): number {
  if (label === "Ana Sayfa") return 0;
  if (label === "Kurum Kategorileri") return 1;
  if (label === "Eğitmenler") return 2;
  return 3;
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function emptyButtons(): [ButtonDraft, ButtonDraft] {
  return [
    { label: "", url: "" },
    { label: "", url: "" },
  ];
}

function buttonDraftFromStored(button: AdvertisementButton): ButtonDraft {
  return { label: button.label, url: button.url.trim() };
}

/** Kullanıcı girdisini kaydedilecek URL’ye dönüştürür; geçersizse null. */
function normalizeSavedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) return null;
  if (/[\u0000-\u001F\u007F<>"'\\]/.test(trimmed)) return null;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (trimmed.includes("://")) return null;
    return trimmed;
  }

  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) return null;
      return trimmed;
    } catch {
      return null;
    }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  const withHttps = `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const parsed = new URL(withHttps);
    if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) return null;
    return withHttps;
  } catch {
    return null;
  }
}

function buttonFieldError(button: ButtonDraft, index: number): ButtonFieldError {
  const label = button.label;
  const editableUrl = button.url.trim();
  const hasLabel = label.trim().length > 0;
  const hasUrl = editableUrl.length > 0;
  if (!hasLabel && !hasUrl) return {};

  const error: ButtonFieldError = {};
  if (!hasLabel || !hasUrl) {
    const message = `${index + 1}. buton için metin ve bağlantı birlikte girilmelidir.`;
    if (!hasLabel) error.label = message;
    if (!hasUrl) error.url = message;
  }
  if (hasLabel) {
    if (label !== label.trim()) error.label = "Buton metninin başında veya sonunda boşluk olamaz.";
    else if (/[\u0000-\u001F\u007F]/.test(label)) error.label = "Buton metninde geçersiz karakter var.";
    else if ([...label].length > BUTTON_LABEL_MAX) {
      error.label = `Buton metni en fazla ${BUTTON_LABEL_MAX} karakter olabilir.`;
    }
  }
  if (hasUrl) {
    const saved = normalizeSavedUrl(button.url);
    if (!saved) {
      error.url =
        "Geçerli bir bağlantı girin. Örn. example.com, https://example.com veya /egitmenler";
    } else if ([...saved].length > BUTTON_URL_MAX) {
      error.url = `Bağlantı en fazla ${BUTTON_URL_MAX} karakter olabilir.`;
    }
  }
  return error;
}

function choiceOf(ad: AdvertisementRecord | null): AdvertiserType {
  return ad?.advertiserType ?? "platform";
}

function initialDrafts(
  placements: AdPlacementRecord[],
  advertisement: AdvertisementRecord | null,
  preselectedPlacementId?: string | null,
): Record<string, PlacementDraft> {
  const drafts: Record<string, PlacementDraft> = {};
  for (const placement of placements) {
    const assignment = advertisement?.assignments.find((item) => item.placementId === placement.id);
    drafts[placement.id] = {
      selected: Boolean(assignment) || (!advertisement && placement.id === preselectedPlacementId),
      startsAt: toLocalInput(assignment?.startsAt ?? null),
      endsAt: toLocalInput(assignment?.endsAt ?? null),
    };
  }
  for (const assignment of advertisement?.assignments ?? []) {
    if (drafts[assignment.placementId]) continue;
    drafts[assignment.placementId] = {
      selected: true,
      startsAt: toLocalInput(assignment.startsAt),
      endsAt: toLocalInput(assignment.endsAt),
    };
  }
  return drafts;
}

function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDisplayDateTime(value: string): string {
  const date = parseLocalDateTime(value);
  if (!date) return "";
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(view: Date): Array<number | null> {
  const first = startOfMonth(view);
  const lastDay = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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

export function AdminAdvertisementForm({
  advertisement,
  placements,
  ads,
  occupancyByPlacement,
  nowMs,
  preselectedPlacementId = null,
  onClose,
  onSaved,
}: {
  advertisement: AdvertisementRecord | null;
  placements: AdPlacementRecord[];
  ads: AdvertisementRecord[];
  occupancyByPlacement: Map<string, number>;
  nowMs: number;
  preselectedPlacementId?: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [initialSnapshot] = useState(() => {
    const buttonsSnapshot = emptyButtons();
    advertisement?.buttons.slice(0, 2).forEach((button, index) => {
      buttonsSnapshot[index] = buttonDraftFromStored(button);
    });
    return {
      title: advertisement?.title ?? "",
      description: advertisement?.description ?? "",
      buttons: buttonsSnapshot,
      secondButtonVisible: Boolean(advertisement?.buttons[1]),
      choice: choiceOf(advertisement),
      institutionId: advertisement?.institutionId ?? null,
      instructorId: advertisement?.instructorId ?? null,
      isActive: advertisement?.isActive ?? true,
      mediaPath: advertisement?.mediaPath ?? "",
      drafts: initialDrafts(placements, advertisement, preselectedPlacementId),
    };
  });

  const [title, setTitle] = useState(initialSnapshot.title);
  const [description, setDescription] = useState(initialSnapshot.description);
  const [buttons, setButtons] = useState<[ButtonDraft, ButtonDraft]>(
    () => initialSnapshot.buttons.map((item) => ({ ...item })) as [ButtonDraft, ButtonDraft],
  );
  const [secondButtonVisible, setSecondButtonVisible] = useState(initialSnapshot.secondButtonVisible);
  const [buttonErrors, setButtonErrors] = useState<[ButtonFieldError, ButtonFieldError]>([{}, {}]);
  const [choice, setChoice] = useState<AdvertiserType>(initialSnapshot.choice);
  const [institutionId, setInstitutionId] = useState<number | null>(initialSnapshot.institutionId);
  const [institutionName, setInstitutionName] = useState(advertisement?.institutionName ?? "");
  const [instructorId, setInstructorId] = useState<number | null>(initialSnapshot.instructorId);
  const [instructorName, setInstructorName] = useState(advertisement?.instructorName ?? "");
  const [advertiserQuery, setAdvertiserQuery] = useState("");
  const [advertiserOptions, setAdvertiserOptions] = useState<AdvertiserOption[]>([]);
  const [advertiserError, setAdvertiserError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initialSnapshot.isActive);
  const [mediaPath, setMediaPath] = useState(initialSnapshot.mediaPath);
  const [mediaType, setMediaType] = useState<AdvertisementMediaType | null>(
    advertisement?.mediaType ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    advertisement ? getAdvertisementMediaPublicUrl(advertisement.mediaPath) : null,
  );
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFileName, setMediaFileName] = useState(advertisement?.mediaPath?.split("/").pop() ?? "");
  const [drafts, setDrafts] = useState<Record<string, PlacementDraft>>(() =>
    structuredClone(initialSnapshot.drafts),
  );
  const [placementQuery, setPlacementQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const savingRef = useRef(false);
  const mediaSelectionRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalMediaPath = advertisement?.mediaPath ?? null;

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (choice === "platform") return;
    const query = advertiserQuery.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result =
          choice === "institution"
            ? await searchAdvertiserInstitutions(query)
            : await searchAdvertiserInstructors(query);
        if (cancelled) return;
        setAdvertiserOptions(result.data ?? []);
        setAdvertiserError(result.error);
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [advertiserQuery, choice]);

  const isDirty = useMemo(() => {
    if (title !== initialSnapshot.title) return true;
    if (description !== initialSnapshot.description) return true;
    if (choice !== initialSnapshot.choice) return true;
    if (institutionId !== initialSnapshot.institutionId) return true;
    if (instructorId !== initialSnapshot.instructorId) return true;
    if (isActive !== initialSnapshot.isActive) return true;
    if (mediaFile) return true;
    if (mediaPath !== initialSnapshot.mediaPath) return true;
    if (secondButtonVisible !== initialSnapshot.secondButtonVisible) return true;
    if (
      buttons[0].label !== initialSnapshot.buttons[0].label ||
      buttons[0].url !== initialSnapshot.buttons[0].url
    ) {
      return true;
    }
    if (
      secondButtonVisible &&
      (buttons[1].label !== initialSnapshot.buttons[1].label ||
        buttons[1].url !== initialSnapshot.buttons[1].url)
    ) {
      return true;
    }
    const ids = new Set([...Object.keys(drafts), ...Object.keys(initialSnapshot.drafts)]);
    for (const id of ids) {
      const current = drafts[id] ?? { selected: false, startsAt: "", endsAt: "" };
      const initial = initialSnapshot.drafts[id] ?? { selected: false, startsAt: "", endsAt: "" };
      if (
        current.selected !== initial.selected ||
        current.startsAt !== initial.startsAt ||
        current.endsAt !== initial.endsAt
      ) {
        return true;
      }
    }
    return false;
  }, [
    buttons,
    choice,
    description,
    drafts,
    initialSnapshot,
    institutionId,
    instructorId,
    isActive,
    mediaFile,
    mediaPath,
    secondButtonVisible,
    title,
  ]);

  const requestClose = () => {
    if (saving) return;
    if (isDirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  const visiblePlacements = useMemo(() => {
    const needle = placementQuery.trim().toLocaleLowerCase("tr");
    return placements.filter((placement) => {
      if (drafts[placement.id]?.selected) return true;
      if (!needle) return true;
      return placementName(placement).toLocaleLowerCase("tr").includes(needle);
    });
  }, [drafts, placementQuery, placements]);

  const selectedPlacementCount = useMemo(
    () => Object.values(drafts).filter((draft) => draft.selected).length,
    [drafts],
  );

  const replacePreview = (next: string | null, blob: boolean) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (blob && next) blobUrlRef.current = next;
    setPreviewUrl(next);
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const validation = validateAdvertisementMediaFile(file);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const selection = mediaSelectionRef.current + 1;
    mediaSelectionRef.current = selection;
    setError(null);
    void (async () => {
      const orientation = await validateAdvertisementMediaOrientation(file, validation.media.mediaType);
      if (mediaSelectionRef.current !== selection) return;
      if (!orientation.ok) {
        setError(orientation.error);
        return;
      }
      setMediaFile(file);
      setMediaFileName(file.name);
      setMediaType(validation.media.mediaType);
      replacePreview(URL.createObjectURL(file), true);
    })();
  };

  const validate = (): string | null => {
    if (!title.trim()) return "Başlık zorunludur.";
    if (!mediaFile && !mediaPath) return "Görsel veya video zorunludur.";
    if (mediaFile) {
      const validation = validateAdvertisementMediaFile(mediaFile);
      if (!validation.ok) return validation.error;
    }
    if (!mediaType) return "Medya türü belirlenemedi.";
    if (choice === "institution" && !institutionId) return "Kurum seçin.";
    if (choice === "instructor" && !instructorId) return "Eğitmen seçin.";

    const visibleButtons = secondButtonVisible ? buttons : ([buttons[0], emptyButtons()[1]] as [
      ButtonDraft,
      ButtonDraft,
    ]);
    const nextButtonErrors = visibleButtons.map((button, index) =>
      index === 1 && !secondButtonVisible ? {} : buttonFieldError(button, index),
    ) as [ButtonFieldError, ButtonFieldError];
    setButtonErrors(nextButtonErrors);
    const buttonMessage = nextButtonErrors.flatMap((item) => [item.label, item.url].filter(Boolean))[0];
    if (buttonMessage) return buttonMessage;

    const selected = Object.entries(drafts).filter(([, draft]) => draft.selected);
    if (selected.length === 0) return "En az bir yayın alanı seçin.";
    for (const [placementId, draft] of selected) {
      const startsAt = fromLocalInput(draft.startsAt);
      const endsAt = fromLocalInput(draft.endsAt);
      if (draft.startsAt.trim() && !startsAt) return "Başlangıç tarihi geçersiz.";
      if (draft.endsAt.trim() && !endsAt) return "Bitiş tarihi geçersiz.";
      if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
        return "Bitiş tarihi başlangıçtan sonra olmalıdır.";
      }
      const usesSlot =
        countPlacementOccupancy([{ endsAt, advertisementIsActive: isActive }], nowMs) === 1;
      if (!usesSlot) continue;
      const others = ads.reduce((count, ad) => {
        if (advertisement && ad.id === advertisement.id) return count;
        return (
          count +
          ad.assignments
            .filter((assignment) => assignment.placementId === placementId)
            .reduce(
              (sum, assignment) =>
                sum +
                countPlacementOccupancy(
                  [{ endsAt: assignment.endsAt, advertisementIsActive: ad.isActive }],
                  nowMs,
                ),
              0,
            )
        );
      }, 0);
      if (others >= PLACEMENT_CAPACITY) {
        const known = placements.find((placement) => placement.id === placementId);
        return `${known ? placementName(known) : "Seçili yayın alanı"} dolu (10/10).`;
      }
    }
    return null;
  };

  const submit = async () => {
    if (savingRef.current) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);

    let nextPath = mediaPath;
    let nextType = mediaType;
    if (mediaFile) {
      const uploaded = await uploadAdvertisementMedia(mediaFile);
      if ("error" in uploaded) {
        setError(uploaded.error);
        savingRef.current = false;
        setSaving(false);
        return;
      }
      nextPath = uploaded.path;
      nextType = uploaded.mediaType;
      setMediaPath(uploaded.path);
      setMediaType(uploaded.mediaType);
      setMediaFile(null);
      replacePreview(uploaded.publicUrl, false);
    }
    if (!nextType || !nextPath) {
      setError("Medya türü belirlenemedi.");
      savingRef.current = false;
      setSaving(false);
      return;
    }

    const originalOrder = new Map(
      (advertisement?.assignments ?? []).map((assignment) => [
        assignment.placementId,
        assignment.displayOrder,
      ]),
    );
    const assignments = Object.entries(drafts)
      .filter(([, draft]) => draft.selected)
      .sort(
        ([leftId], [rightId]) =>
          (originalOrder.get(leftId) ?? 10000) - (originalOrder.get(rightId) ?? 10000),
      )
      .map(([placementId, draft]) => ({
        placementId,
        startsAt: fromLocalInput(draft.startsAt),
        endsAt: fromLocalInput(draft.endsAt),
      }));

    const buttonsToSave = (secondButtonVisible ? buttons : [buttons[0]])
      .map((button) => {
        const url = normalizeSavedUrl(button.url);
        const label = button.label.trim();
        if (!label || !url) return null;
        return { label, url };
      })
      .filter((button): button is AdvertisementButton => Boolean(button));

    const result = await saveAdvertisement({
      id: advertisement?.id ?? null,
      title: title.trim(),
      description: description.trim(),
      mediaType: nextType,
      mediaPath: nextPath,
      buttons: buttonsToSave,
      advertiserType: choice,
      institutionId: choice === "institution" ? institutionId : null,
      instructorId: choice === "instructor" ? instructorId : null,
      isActive,
      assignments,
    });

    if (result.error) {
      setError(result.error);
      savingRef.current = false;
      setSaving(false);
      return;
    }

    let message = "Reklam kaydedildi.";
    if (originalMediaPath && originalMediaPath !== nextPath) {
      const cleanupError = await requestMediaCleanup(originalMediaPath);
      if (cleanupError) message = `Reklam kaydedildi. ${cleanupError}`;
    }
    savingRef.current = false;
    setSaving(false);
    onSaved(message);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, AdPlacementRecord[]>();
    for (const placement of visiblePlacements) {
      const label = groupLabel(placement.placementType);
      map.set(label, [...(map.get(label) ?? []), placement]);
    }
    return [...map.entries()].sort((a, b) => groupOrder(a[0]) - groupOrder(b[0]));
  }, [visiblePlacements]);

  const updateButton = (index: 0 | 1, patch: Partial<ButtonDraft>) => {
    setButtons((current) => {
      const next = [...current] as [ButtonDraft, ButtonDraft];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setButtonErrors((current) => {
      const next = [...current] as [ButtonFieldError, ButtonFieldError];
      next[index] = {
        label: patch.label !== undefined ? undefined : next[index].label,
        url: patch.url !== undefined ? undefined : next[index].url,
      };
      return next;
    });
  };

  return (
    <div className="admin-ads-form-overlay" role="presentation">
      <div
        className="admin-ads-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-ad-form-title"
      >
        <div className="admin-ads-form-header">
          <h2 id="admin-ad-form-title" className="admin-ads-form-title">
            {advertisement ? "Reklamı Düzenle" : "Yeni Reklam"}
          </h2>
          <button
            type="button"
            className="admin-ads-form-close"
            aria-label="Kapat"
            onClick={requestClose}
            disabled={saving}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="admin-ads-form-body">
          {error ? (
            <p className="admin-ads-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <section className="admin-ads-form-block" aria-labelledby="admin-ad-details-heading">
            <h3 id="admin-ad-details-heading" className="admin-ads-form-heading">
              Reklam Bilgileri
            </h3>
            <label className="admin-ads-form-field">
              <span>Başlık</span>
              <input
                value={title}
                placeholder="Örn. Merkezden Çok Yakında Sizlerle!"
                disabled={saving}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="admin-ads-form-field">
              <span>Açıklama</span>
              <textarea
                rows={2}
                value={description}
                placeholder="Kısa bir açıklama yazın..."
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>


            <div className="admin-ads-form-field">
              <span>Medya</span>
              <input
                ref={fileInputRef}
                type="file"
                className="admin-ads-form-file-input"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                disabled={saving}
                onChange={(event) => {
                  onFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              {previewUrl ? (
                <div className="admin-ads-form-media-preview">
                  {mediaType === "video" ? (
                    <video src={previewUrl} controls muted playsInline />
                  ) : (
                    <img src={previewUrl} alt="" />
                  )}
                  <div className="admin-ads-form-media-meta">
                    <span>{mediaFileName || (mediaType === "video" ? "Video" : "Görsel")}</span>
                    <button
                      type="button"
                      className="admin-ads-form-link-btn"
                      disabled={saving}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Değiştir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="admin-ads-form-upload-row">
                  <ImagePlus size={18} strokeWidth={1.75} aria-hidden />
                  <div className="admin-ads-form-upload-copy">
                    <strong>Görsel veya video seç</strong>
                    <span>Yatay medya · JPG, PNG, WebP, MP4, WebM · 10 MB</span>
                  </div>
                  <button
                    type="button"
                    className="admin-ads-form-upload-btn"
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Dosya Seç
                  </button>
                </div>
              )}
            </div>
          </section>


          <section className="admin-ads-form-block" aria-labelledby="admin-ad-buttons-heading">
            <h3 id="admin-ad-buttons-heading" className="admin-ads-form-heading">
              Reklam Butonları
            </h3>
            <div className="admin-ads-form-button-row">
              <label className="admin-ads-form-field">
                <span>1. Buton Metni</span>
                <input
                  value={buttons[0].label}
                  maxLength={BUTTON_LABEL_MAX}
                  placeholder="Örn. Keşfedin"
                  disabled={saving}
                  onChange={(event) => updateButton(0, { label: event.target.value })}
                />
                {buttonErrors[0]?.label ? (
                  <em className="admin-ads-form-field-error">{buttonErrors[0].label}</em>
                ) : null}
              </label>
              <label className="admin-ads-form-field">
                <span>1. Buton Bağlantısı</span>
                <input
                  value={buttons[0].url}
                  maxLength={BUTTON_URL_MAX}
                  placeholder="https://ornek.com veya /egitmenler"
                  disabled={saving}
                  onChange={(event) => updateButton(0, { url: event.target.value })}
                />
                {buttonErrors[0]?.url ? (
                  <em className="admin-ads-form-field-error">{buttonErrors[0].url}</em>
                ) : null}
              </label>
            </div>

            {secondButtonVisible ? (
              <>
                <div className="admin-ads-form-button-block-head">
                  <strong>2. Buton</strong>
                  <button
                    type="button"
                    className="admin-ads-form-link-btn admin-ads-form-link-btn--danger"
                    disabled={saving}
                    onClick={() => setSecondButtonVisible(false)}
                  >
                    Kaldır
                  </button>
                </div>
                <div className="admin-ads-form-button-row">
                  <label className="admin-ads-form-field">
                    <span>2. Buton Metni</span>
                    <input
                      value={buttons[1].label}
                      maxLength={BUTTON_LABEL_MAX}
                      placeholder="Örn. Bize Ulaşın"
                      disabled={saving}
                      onChange={(event) => updateButton(1, { label: event.target.value })}
                    />
                    {buttonErrors[1]?.label ? (
                      <em className="admin-ads-form-field-error">{buttonErrors[1].label}</em>
                    ) : null}
                  </label>
                  <label className="admin-ads-form-field">
                    <span>2. Buton Bağlantısı</span>
                    <input
                      value={buttons[1].url}
                      maxLength={BUTTON_URL_MAX}
                      placeholder="https://ornek.com veya /egitmenler"
                      disabled={saving}
                      onChange={(event) => updateButton(1, { url: event.target.value })}
                    />
                    {buttonErrors[1]?.url ? (
                      <em className="admin-ads-form-field-error">{buttonErrors[1].url}</em>
                    ) : null}
                  </label>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="admin-ads-form-secondary-action"
                disabled={saving}
                onClick={() => setSecondButtonVisible(true)}
              >
                + İkinci Buton Ekle
              </button>
            )}
          </section>


          <section className="admin-ads-form-block" aria-labelledby="admin-ad-advertiser-heading">
            <h3 id="admin-ad-advertiser-heading" className="admin-ads-form-heading">
              Reklamveren ve Durum
            </h3>
            <div className="admin-ads-form-field">
              <span>Reklamveren türü</span>
              <div className="admin-ads-form-segmented" role="group" aria-label="Reklamveren türü">
                {CHOICES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      choice === option.value
                        ? "admin-ads-form-segmented__btn admin-ads-form-segmented__btn--active"
                        : "admin-ads-form-segmented__btn"
                    }
                    disabled={saving}
                    onClick={() => {
                      setChoice(option.value);
                      setAdvertiserQuery("");
                      setAdvertiserOptions([]);
                      setAdvertiserError(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {choice !== "platform" ? (
              <div className="admin-ads-form-field">
                <span>{choice === "institution" ? "Kurum" : "Eğitmen"}</span>
                {(choice === "institution" ? institutionName : instructorName) ? (
                  <div className="admin-ads-form-selected-advertiser">
                    <strong>
                      {choice === "institution" ? institutionName : instructorName}
                    </strong>
                    <button
                      type="button"
                      className="admin-ads-form-link-btn"
                      disabled={saving}
                      onClick={() => {
                        if (choice === "institution") {
                          setInstitutionId(null);
                          setInstitutionName("");
                        } else {
                          setInstructorId(null);
                          setInstructorName("");
                        }
                      }}
                    >
                      Değiştir
                    </button>
                  </div>
                ) : null}
                <input
                  value={advertiserQuery}
                  placeholder="En az 2 karakter yazarak ara..."
                  disabled={saving}
                  onChange={(event) => {
                    setAdvertiserQuery(event.target.value);
                    if (event.target.value.trim().length < 2) setAdvertiserOptions([]);
                  }}
                />
                {advertiserError ? (
                  <em className="admin-ads-form-field-error">{advertiserError}</em>
                ) : null}
                {advertiserOptions.length > 0 ? (
                  <div className="admin-ads-form-advertiser-results">
                    {advertiserOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          if (choice === "institution") {
                            setInstitutionId(option.id);
                            setInstitutionName(option.name);
                          } else {
                            setInstructorId(option.id);
                            setInstructorName(option.name);
                          }
                          setAdvertiserQuery("");
                          setAdvertiserOptions([]);
                        }}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="admin-ads-form-field">
              <span>Merkezi yayın durumu</span>
              <div className="admin-ads-form-segmented" role="group" aria-label="Yayın durumu">
                <button
                  type="button"
                  className={
                    isActive
                      ? "admin-ads-form-segmented__btn admin-ads-form-segmented__btn--active"
                      : "admin-ads-form-segmented__btn"
                  }
                  disabled={saving}
                  onClick={() => setIsActive(true)}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  className={
                    !isActive
                      ? "admin-ads-form-segmented__btn admin-ads-form-segmented__btn--active"
                      : "admin-ads-form-segmented__btn"
                  }
                  disabled={saving}
                  onClick={() => setIsActive(false)}
                >
                  Pasif
                </button>
              </div>
            </div>
          </section>


          <section className="admin-ads-form-block" aria-labelledby="admin-ad-placements-heading">
            <div className="admin-ads-form-placements-head">
              <h3 id="admin-ad-placements-heading" className="admin-ads-form-heading">
                Yayın Alanları
              </h3>
              <span className="admin-ads-form-count-badge">{selectedPlacementCount} seçili</span>
            </div>
            <p className="admin-ads-form-hint">
              Reklamın nerelerde ve ne zaman yayınlanacağını belirle.
            </p>
            <label className="admin-ads-form-field">
              <span>Alan ara</span>
              <input
                value={placementQuery}
                placeholder="Yayın alanı ara..."
                disabled={saving}
                onChange={(event) => setPlacementQuery(event.target.value)}
              />
            </label>

            {grouped.map(([label, items]) => (
              <div key={label} className="admin-ads-form-placement-group">
                <strong>{label}</strong>
                <div className="admin-ads-form-placement-list">
                  {items.map((placement) => {
                    const draft =
                      drafts[placement.id] ?? { selected: false, startsAt: "", endsAt: "" };
                    const occupancy = occupancyByPlacement.get(placement.id) ?? 0;
                    const alreadyAssigned =
                      advertisement?.assignments.some(
                        (assignment) => assignment.placementId === placement.id,
                      ) ?? false;
                    const full = occupancy >= PLACEMENT_CAPACITY;
                    const disabledSelect = saving || (full && !alreadyAssigned && !draft.selected);
                    return (
                      <div
                        key={placement.id}
                        className={`admin-ads-form-placement-row${
                          draft.selected ? " admin-ads-form-placement-row--selected" : ""
                        }`}
                      >
                        <label className="admin-ads-form-placement-check">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            disabled={disabledSelect}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [placement.id]: {
                                  ...(current[placement.id] ?? draft),
                                  selected: event.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="admin-ads-form-placement-name">
                            {placementName(placement)}
                            {!placement.isEnabled ? " · Kapalı" : ""}
                          </span>
                          <span
                            className={
                              full ? "admin-ads-form-occ admin-ads-form-occ--full" : "admin-ads-form-occ"
                            }
                          >
                            {occupancy}/{PLACEMENT_CAPACITY}
                            {full ? " · Dolu" : ""}
                          </span>
                        </label>
                        {draft.selected ? (
                          <div className="admin-ads-form-schedule">
                            <AdsDateTimeField
                              label="Başlangıç"
                              emptyLabel="Hemen"
                              value={draft.startsAt}
                              disabled={saving}
                              onChange={(next) =>
                                setDrafts((current) => {
                                  const prev =
                                    current[placement.id] ?? {
                                      selected: false,
                                      startsAt: "",
                                      endsAt: "",
                                    };
                                  return {
                                    ...current,
                                    [placement.id]: { ...prev, startsAt: next },
                                  };
                                })
                              }
                            />
                            <AdsDateTimeField
                              label="Bitiş"
                              emptyLabel="Süresiz"
                              value={draft.endsAt}
                              disabled={saving}
                              onChange={(next) =>
                                setDrafts((current) => {
                                  const prev =
                                    current[placement.id] ?? {
                                      selected: false,
                                      startsAt: "",
                                      endsAt: "",
                                    };
                                  return {
                                    ...current,
                                    [placement.id]: { ...prev, endsAt: next },
                                  };
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.entries(drafts)
              .filter(([placementId]) => !placements.some((placement) => placement.id === placementId))
              .map(([placementId, draft]) => (
                <div
                  key={placementId}
                  className={`admin-ads-form-placement-row${
                    draft.selected ? " admin-ads-form-placement-row--selected" : ""
                  }`}
                >
                  <label className="admin-ads-form-placement-check">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      disabled={saving}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [placementId]: {
                            ...(current[placementId] ?? draft),
                            selected: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span className="admin-ads-form-placement-name">Kayıtlı yayın alanı</span>
                  </label>
                  {draft.selected ? (
                    <div className="admin-ads-form-schedule">
                      <AdsDateTimeField
                        label="Başlangıç"
                        emptyLabel="Hemen"
                        value={draft.startsAt}
                        disabled={saving}
                        onChange={(next) =>
                          setDrafts((current) => {
                            const prev =
                              current[placementId] ?? {
                                selected: false,
                                startsAt: "",
                                endsAt: "",
                              };
                            return {
                              ...current,
                              [placementId]: { ...prev, startsAt: next },
                            };
                          })
                        }
                      />
                      <AdsDateTimeField
                        label="Bitiş"
                        emptyLabel="Süresiz"
                        value={draft.endsAt}
                        disabled={saving}
                        onChange={(next) =>
                          setDrafts((current) => {
                            const prev =
                              current[placementId] ?? {
                                selected: false,
                                startsAt: "",
                                endsAt: "",
                              };
                            return {
                              ...current,
                              [placementId]: { ...prev, endsAt: next },
                            };
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
          </section>
        </div>

        <div className="admin-ads-form-footer">
          <button
            type="button"
            className="admin-ads-form-save"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {confirmClose ? (
        <div className="admin-ads-form-confirm" role="dialog" aria-modal="true" aria-labelledby="admin-ad-close-title">
          <div className="admin-ads-form-confirm-card">
            <h3 id="admin-ad-close-title">Değişiklikler kaydedilmedi</h3>
            <p>Kaydetmeden kapatmak istediğinize emin misiniz?</p>
            <div className="admin-ads-form-confirm-actions">
              <button type="button" className="admin-ads-form-confirm-cancel" onClick={() => setConfirmClose(false)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="admin-ads-form-confirm-discard"
                onClick={() => {
                  setConfirmClose(false);
                  onClose();
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdsDateTimeField({
  label,
  emptyLabel,
  value,
  disabled,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = useMemo(() => parseLocalDateTime(value), [value]);
  const [view, setView] = useState<Date>(() => startOfMonth(selected ?? new Date()));
  const [hour, setHour] = useState(() => (selected ? selected.getHours() : 9));
  const [minute, setMinute] = useState(() => (selected ? selected.getMinutes() : 0));

  const close = useCallback(() => setOpen(false), []);

  const openPicker = () => {
    const parsed = parseLocalDateTime(value);
    const base = parsed ?? new Date();
    setView(startOfMonth(base));
    setHour(parsed ? parsed.getHours() : 9);
    setMinute(parsed ? parsed.getMinutes() : 0);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = Math.min(280, window.innerWidth - 16);
      const popoverHeight = 360;
      const gap = 6;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popoverWidth - 8);
      }
      const below = rect.bottom + gap;
      const above = rect.top - gap - popoverHeight;
      const top =
        below + popoverHeight <= window.innerHeight - 8
          ? below
          : Math.max(8, above > 8 ? above : below);
      setCoords({ top, left, width: Math.max(rect.width, 220) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      if (target.closest('[role="listbox"]')) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (popoverRef.current?.querySelector('[role="combobox"][data-state="open"]')) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [close, open]);

  const cells = useMemo(() => buildMonthGrid(view), [view]);
  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => now - 1 + index);
  }, []);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: index,
        label: MONTH_NAME_FMT.format(new Date(2000, index, 1)),
      })),
    [],
  );

  const applyDate = (day: number) => {
    onChange(formatLocalDateTime(new Date(view.getFullYear(), view.getMonth(), day, hour, minute)));
  };

  const applyTime = (nextHour: number, nextMinute: number) => {
    setHour(nextHour);
    setMinute(nextMinute);
    const base = selected ?? new Date(view.getFullYear(), view.getMonth(), view.getDate() || 1);
    const day = selected?.getDate() ?? base.getDate();
    onChange(
      formatLocalDateTime(new Date(base.getFullYear(), base.getMonth(), day, nextHour, nextMinute)),
    );
  };

  const display = value.trim() ? formatDisplayDateTime(value) : emptyLabel;

  return (
    <div className="admin-ads-form-datetime">
      <span className="admin-ads-form-datetime-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`admin-ads-form-datetime-trigger${!value.trim() ? " admin-ads-form-datetime-trigger--empty" : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) {
            close();
            return;
          }
          openPicker();
        }}
      >
        <span>{display}</span>
        <Calendar size={16} strokeWidth={1.75} aria-hidden />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={popoverRef}
              className="admin-ads-form-datetime-popover"
              role="dialog"
              aria-label={label}
              id={listId}
              style={{
                top: coords.top,
                left: coords.left,
                width: Math.min(280, Math.max(coords.width, 240)),
              }}
            >
              <div className="admin-ads-form-datetime-toolbar">
                <Select
                  value={String(view.getMonth())}
                  onValueChange={(next) =>
                    setView((current) => new Date(current.getFullYear(), Number(next), 1))
                  }
                >
                  <SelectTrigger size="sm" className="admin-ads-form-datetime-select" aria-label="Ay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className="admin-ads-select-content"
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    align="start"
                  >
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(view.getFullYear())}
                  onValueChange={(next) =>
                    setView((current) => new Date(Number(next), current.getMonth(), 1))
                  }
                >
                  <SelectTrigger size="sm" className="admin-ads-form-datetime-select" aria-label="Yıl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className="admin-ads-select-content"
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    align="start"
                  >
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="admin-ads-form-datetime-weekdays" aria-hidden>
                {WEEKDAY_LABELS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className="admin-ads-form-datetime-grid">
                {cells.map((day, index) => {
                  if (day == null) {
                    return <span key={`e-${index}`} className="admin-ads-form-datetime-cell" />;
                  }
                  const isSelected =
                    selected != null &&
                    selected.getFullYear() === view.getFullYear() &&
                    selected.getMonth() === view.getMonth() &&
                    selected.getDate() === day;
                  return (
                    <button
                      key={`${view.getFullYear()}-${view.getMonth()}-${day}`}
                      type="button"
                      className={`admin-ads-form-datetime-cell admin-ads-form-datetime-cell--day${
                        isSelected ? " admin-ads-form-datetime-cell--selected" : ""
                      }`}
                      onClick={() => applyDate(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="admin-ads-form-datetime-time">
                <Select value={String(hour)} onValueChange={(next) => applyTime(Number(next), minute)}>
                  <SelectTrigger size="sm" className="admin-ads-form-datetime-select" aria-label="Saat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className="admin-ads-select-content"
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    align="start"
                  >
                    {Array.from({ length: 24 }, (_, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {pad2(index)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(minute)} onValueChange={(next) => applyTime(hour, Number(next))}>
                  <SelectTrigger size="sm" className="admin-ads-form-datetime-select" aria-label="Dakika">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    className="admin-ads-select-content"
                    position="popper"
                    side="bottom"
                    sideOffset={4}
                    align="start"
                  >
                    {Array.from({ length: 12 }, (_, index) => index * 5).map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {pad2(item)}
                      </SelectItem>
                    ))}
                    {minute % 5 !== 0 ? (
                      <SelectItem value={String(minute)}>{pad2(minute)}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="admin-ads-form-datetime-footer">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                >
                  {emptyLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setSeconds(0, 0);
                    onChange(formatLocalDateTime(now));
                    close();
                  }}
                >
                  Şimdi
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
