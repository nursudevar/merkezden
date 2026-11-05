"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CloudUpload, Image as ImageIcon, PencilLine, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AnnouncementLocationFields } from "@/components/announcements/AnnouncementLocationFields";
import { EgitmenFormSelect } from "@/app/egitmen-paneli/EgitmenFormSelect";
import {
  ANNOUNCEMENT_TAG_OPTIONS,
  ANNOUNCEMENT_TAG_REQUIRED_ERROR,
  normalizeAnnouncementTag,
} from "@/lib/announcementTags";
import { isAnnouncementExpiredWhileActive } from "@/lib/announcementPublication";
import {
  ADMIN_ANNOUNCEMENT_ERROR,
  adminAnnouncementImageError,
  createAdminAnnouncementClient,
  deleteAdminAnnouncementClient,
  fetchAdminAnnouncementsClient,
  updateAdminAnnouncementClient,
  type AdminAnnouncementRow,
} from "@/lib/adminAnnouncementsClient";
import {
  INSTRUCTOR_ANNOUNCEMENT_LINK_URL_ERROR,
  isValidOptionalAnnouncementLinkUrl,
  normalizeAnnouncementLinkUrl,
} from "@/lib/instructorAnnouncementsClient";
import { parseLocationId, toLocationIdString } from "@/lib/turkiyeLocationsClient";
import "@/styles/pages/egitmen-panel.scss";

type FormState = {
  title: string;
  content: string;
  linkUrl: string;
  announcementTag: string;
  isActive: boolean;
  ilId: string;
  ilceId: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  linkUrl: "",
  announcementTag: "",
  isActive: true,
  ilId: "",
  ilceId: "",
};

function formatAnnouncementDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function contentPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 80) return normalized || "—";
  return `${normalized.slice(0, 80).trim()}…`;
}

function AnnouncementTableThumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  const trimmed = String(url ?? "").trim();

  if (!trimmed || failed) {
    return (
      <div className="egitmen-panel-announcements-thumb egitmen-panel-announcements-thumb--fallback" aria-hidden>
        <ImageIcon className="egitmen-panel-announcements-thumb-icon" />
      </div>
    );
  }

  return (
    <img
      src={trimmed}
      alt=""
      className="egitmen-panel-announcements-thumb egitmen-panel-announcements-thumb--image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export type AdminAnnouncementsTabHandle = {
  openCreate: () => void;
};

export const AdminAnnouncementsTab = forwardRef<AdminAnnouncementsTabHandle>(
  function AdminAnnouncementsTab(_props, ref) {
  const [items, setItems] = useState<AdminAnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<AdminAnnouncementRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    content?: string;
    linkUrl?: string;
    announcementTag?: string;
  }>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemovePending, setImageRemovePending] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editingRow = useMemo(
    () => (editingId != null ? items.find((row) => row.id === editingId) ?? null : null),
    [editingId, items],
  );

  const editingDbImageUrl = useMemo(() => {
    const raw = String(editingRow?.announcement_image_url ?? "").trim();
    return raw || null;
  }, [editingRow]);

  const previewSrc = useMemo(() => {
    if (imageObjectUrl) return imageObjectUrl;
    if (imageRemovePending) return null;
    return editingDbImageUrl;
  }, [imageObjectUrl, imageRemovePending, editingDbImageUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { items: rows, error: loadError } = await fetchAdminAnnouncementsClient();
      if (cancelled) return;
      setItems(rows);
      setError(loadError);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  const replaceImagePreview = (file: File | null) => {
    setImageObjectUrl(file ? URL.createObjectURL(file) : null);
    setImageFile(file);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    replaceImagePreview(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const closeModal = () => {
    if (saving) return;
    resetModal();
  };

  const openNewModal = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    replaceImagePreview(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setError(null);
    setModalOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({ openCreate: openNewModal }), [openNewModal]);

  const openEditModal = (row: AdminAnnouncementRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      content: row.content,
      linkUrl: String(row.link_url ?? ""),
      announcementTag: normalizeAnnouncementTag(row.announcement_tag) ?? "",
      isActive: row.is_active === true,
      ilId: toLocationIdString(row.il_id),
      ilceId: toLocationIdString(row.ilce_id),
    });
    setFormErrors({});
    replaceImagePreview(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setError(null);
    setModalOpen(true);
  };

  const handleImageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const imageError = adminAnnouncementImageError(file);
    if (imageError) {
      setError(imageError);
      event.target.value = "";
      return;
    }
    setImageRemovePending(false);
    replaceImagePreview(file);
  };

  const handleImageDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const imageError = adminAnnouncementImageError(file);
    if (imageError) {
      setError(imageError);
      return;
    }
    setImageRemovePending(false);
    replaceImagePreview(file);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const linkRaw = form.linkUrl.trim();
    const announcementTag = normalizeAnnouncementTag(form.announcementTag);
    const nextErrors: typeof formErrors = {};
    if (!title) nextErrors.title = "Başlık zorunludur.";
    if (!content) nextErrors.content = "İçerik zorunludur.";
    if (!announcementTag) nextErrors.announcementTag = ANNOUNCEMENT_TAG_REQUIRED_ERROR;
    if (linkRaw && !isValidOptionalAnnouncementLinkUrl(linkRaw)) {
      nextErrors.linkUrl = INSTRUCTOR_ANNOUNCEMENT_LINK_URL_ERROR;
    }
    if (imageFile) {
      const imageError = adminAnnouncementImageError(imageFile);
      if (imageError) {
        setError(imageError);
        return;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }
    if (saving || !announcementTag) return;

    setSaving(true);
    setError(null);
    const input = {
      title,
      content,
      link_url: normalizeAnnouncementLinkUrl(linkRaw),
      announcement_tag: announcementTag,
      is_active: form.isActive,
      il_id: parseLocationId(form.ilId),
      ilce_id: parseLocationId(form.ilceId),
      imageFile,
      removeImage: imageRemovePending,
    };

    const result =
      editingId != null && editingRow
        ? await updateAdminAnnouncementClient(
            editingId,
            {
              announcement_image_url: editingRow.announcement_image_url,
              image_path: editingRow.image_path,
            },
            input,
          )
        : await createAdminAnnouncementClient(input);

    setSaving(false);
    if (result.error || !result.row) {
      setError(result.error ?? ADMIN_ANNOUNCEMENT_ERROR);
      return;
    }
    setItems((prev) => {
      const without = prev.filter((row) => row.id !== result.row?.id);
      return [result.row as AdminAnnouncementRow, ...without].sort(compareAdminAnnouncements);
    });
    resetModal();
  };

  const handleDelete = async () => {
    if (!deleteConfirmRow || deletingId != null) return;
    setDeletingId(deleteConfirmRow.id);
    setError(null);
    const { error: deleteError } = await deleteAdminAnnouncementClient(deleteConfirmRow);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== deleteConfirmRow.id));
    setDeleteConfirmRow(null);
  };

  return (
    <>
      {error && !modalOpen ? (
        <p className="egitmen-panel-save-message egitmen-panel-save-message--error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="egitmen-panel-form-loading">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="egitmen-panel-announcements-empty">
          <p className="egitmen-panel-announcements-empty-title">Henüz duyuru eklenmemiş.</p>
          <p className="egitmen-panel-announcements-empty-desc">
            İlk duyurunuzu oluşturarak ziyaretçilere güncel bilgileri aktarabilirsiniz.
          </p>
          <button type="button" className="egitmen-panel-announcements-add-btn" onClick={openNewModal}>
            <Plus className="egitmen-panel-announcements-add-btn-icon" aria-hidden />
            Yeni Duyuru
          </button>
        </div>
      ) : (
        <div className="egitmen-panel-announcements-table-wrap">
          <table className="egitmen-panel-announcements-table">
            <thead>
              <tr>
                <th className="egitmen-panel-announcements-th egitmen-panel-announcements-th--image">Görsel</th>
                <th className="egitmen-panel-announcements-th">Başlık</th>
                <th className="egitmen-panel-announcements-th">İçerik</th>
                <th className="egitmen-panel-announcements-th">Tarih</th>
                <th className="egitmen-panel-announcements-th">Aktiflik Durumu</th>
                <th className="egitmen-panel-announcements-th egitmen-panel-announcements-th--actions">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const expired = isAnnouncementExpiredWhileActive(row.is_active, row.published_at);
                const active = row.is_active === true && !expired;
                return (
                  <tr key={String(row.id)} className="egitmen-panel-announcements-tr">
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--image">
                      <AnnouncementTableThumb key={String(row.announcement_image_url ?? "")} url={row.announcement_image_url} />
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--title">
                      {row.title || "—"}
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--desc">
                      <span className="egitmen-panel-announcements-desc-clamp" title={row.content}>
                        {contentPreview(row.content)}
                      </span>
                    </td>
                    <td className="egitmen-panel-announcements-td">
                      {formatAnnouncementDate(row.published_at ?? row.created_at)}
                    </td>
                    <td className="egitmen-panel-announcements-td">
                      <span
                        className={
                          active
                            ? "egitmen-panel-announcements-badge egitmen-panel-announcements-badge--published"
                            : "egitmen-panel-announcements-badge egitmen-panel-announcements-badge--passive"
                        }
                      >
                        {expired ? "Süresi Doldu" : row.is_active ? "Yayında" : "Pasif"}
                      </span>
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--actions">
                      <button
                        type="button"
                        className="egitmen-panel-announcements-action-btn"
                        onClick={() => openEditModal(row)}
                        aria-label="Duyuru düzenle"
                      >
                        <PencilLine className="egitmen-panel-announcements-action-icon" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="egitmen-panel-announcements-action-btn"
                        onClick={() => setDeleteConfirmRow(row)}
                        disabled={deletingId === row.id}
                        aria-label="Duyuru sil"
                      >
                        <Trash2 className="egitmen-panel-announcements-action-icon" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirmRow ? (
        <div
          className="egitmen-panel-confirm-modal-overlay"
          onClick={() => {
            if (deletingId == null) setDeleteConfirmRow(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-announcement-delete-title"
        >
          <div className="egitmen-panel-confirm-modal-content" onClick={(event) => event.stopPropagation()}>
            <h2 id="admin-announcement-delete-title" className="egitmen-panel-confirm-modal-title">
              Duyuruyu Sil
            </h2>
            <div className="egitmen-panel-confirm-modal-body">
              <p className="egitmen-panel-confirm-modal-message">
                <strong>{deleteConfirmRow.title}</strong> başlıklı duyuruyu silmek istediğinize emin
                misiniz? Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="egitmen-panel-confirm-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--cancel"
                onClick={() => setDeleteConfirmRow(null)}
                disabled={deletingId != null}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--danger"
                onClick={() => void handleDelete()}
                disabled={deletingId != null}
              >
                {deletingId != null ? "Siliniyor..." : "Sil"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="egitmen-panel-announcement-modal-overlay" onClick={closeModal} role="presentation">
          <div
            className="egitmen-panel-announcement-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-announcement-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="admin-announcement-modal-title" className="egitmen-panel-announcement-modal-title">
              {editingId != null ? "Duyuruyu Düzenle" : "Yeni Duyuru"}
            </h2>
            <div className="egitmen-panel-announcement-modal-body">
              {error ? <p className="egitmen-panel-announcement-modal-error">{error}</p> : null}
              <div className="egitmen-panel-announcement-modal-form">
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label">BAŞLIK</label>
                  <Input
                    type="text"
                    value={form.title}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, title: event.target.value }));
                      setFormErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    className="egitmen-panel-form-input"
                    disabled={saving}
                  />
                  {formErrors.title ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.title}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label" htmlFor="admin-announcement-tag">
                    Duyuru Etiketi
                  </label>
                  <EgitmenFormSelect
                    id="admin-announcement-tag"
                    value={form.announcementTag}
                    onChange={(next) => {
                      setForm((prev) => ({ ...prev, announcementTag: next }));
                      setFormErrors((prev) => ({ ...prev, announcementTag: undefined }));
                    }}
                    options={ANNOUNCEMENT_TAG_OPTIONS}
                    placeholder="Etiket seçiniz"
                    ariaLabel="Duyuru Etiketi"
                    disabled={saving}
                  />
                  {formErrors.announcementTag ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.announcementTag}</span>
                  ) : null}
                </div>
                <AnnouncementLocationFields
                  ilId={form.ilId}
                  ilceId={form.ilceId}
                  disabled={saving}
                  onIlChange={(nextIlId) => setForm((prev) => ({ ...prev, ilId: nextIlId, ilceId: "" }))}
                  onIlceChange={(nextIlceId) => setForm((prev) => ({ ...prev, ilceId: nextIlceId }))}
                  rowClassName="egitmen-panel-form-row"
                  fieldClassName="egitmen-panel-form-field"
                  labelClassName="egitmen-panel-form-label"
                  selectTriggerClassName="egitmen-panel-announcement-status-select"
                  selectContentClassName="select-content egitmen-panel-location-select-content"
                  ilSelectId="admin-announcement-il"
                  ilceSelectId="admin-announcement-ilce"
                />
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label">İÇERİK</label>
                  <textarea
                    value={form.content}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, content: event.target.value }));
                      setFormErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                    className="egitmen-panel-form-textarea"
                    rows={4}
                    disabled={saving}
                  />
                  {formErrors.content ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.content}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label" htmlFor="admin-announcement-link-url">
                    BAĞLANTI LİNKİ
                  </label>
                  <Input
                    id="admin-announcement-link-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://"
                    value={form.linkUrl}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, linkUrl: event.target.value }));
                      setFormErrors((prev) => ({ ...prev, linkUrl: undefined }));
                    }}
                    className="egitmen-panel-form-input"
                    disabled={saving}
                  />
                  {formErrors.linkUrl ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.linkUrl}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label" htmlFor="admin-announcement-status">
                    DUYURUNUN AKTİFLİK DURUMU
                  </label>
                  <select
                    id="admin-announcement-status"
                    className="egitmen-panel-announcement-status-select"
                    value={form.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, isActive: event.target.value === "active" }))
                    }
                    disabled={saving}
                    aria-label="Duyuru durumu"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                  {editingRow &&
                  isAnnouncementExpiredWhileActive(editingRow.is_active, editingRow.published_at) ? (
                    <p className="egitmen-panel-media-upload-subtitle">
                      Süresi doldu. İçerik düzenlenebilir. Yeniden yayın, kayıt pasife alındıktan
                      sonra tek adımda yapılır.
                    </p>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field egitmen-panel-announcement-image-field">
                  <input
                    id="admin-announcement-image-input"
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="egitmen-panel-announcement-image-file-input"
                    aria-label="Duyuru görseli seç"
                    onChange={handleImageInputChange}
                    disabled={saving}
                  />
                  <div className="egitmen-panel-media-upload-card egitmen-panel-media-upload-card--announcement-modal">
                    <div className="egitmen-panel-media-upload-head">
                      <div className="egitmen-panel-media-upload-head-text">
                        <h4 className="egitmen-panel-media-upload-title">Fotoğraf Yükle</h4>
                        <p className="egitmen-panel-media-upload-subtitle">PNG, JPG veya WEBP (Maks 10MB)</p>
                      </div>
                      <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
                        <ImageIcon className="egitmen-panel-media-upload-icon" />
                      </div>
                    </div>
                    {previewSrc ? (
                      <div
                        className="egitmen-panel-dropzone egitmen-panel-dropzone--announcement-preview"
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onDrop={handleImageDrop}
                      >
                        <img
                          src={previewSrc}
                          alt=""
                          className="egitmen-panel-announcement-dropzone-preview-img"
                        />
                        <div className="egitmen-panel-announcement-image-preview-overlay">
                          <button
                            type="button"
                            className="egitmen-panel-announcement-image-preview-btn"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={saving}
                          >
                            Görseli değiştir
                          </button>
                          <button
                            type="button"
                            className="egitmen-panel-announcement-image-preview-btn egitmen-panel-announcement-image-preview-btn--muted"
                            onClick={() => {
                              if (saving) return;
                              if (imageFile) {
                                replaceImagePreview(null);
                                if (imageInputRef.current) imageInputRef.current.value = "";
                                return;
                              }
                              if (editingDbImageUrl) setImageRemovePending(true);
                            }}
                            disabled={saving}
                          >
                            Görseli kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className="egitmen-panel-dropzone"
                        htmlFor="admin-announcement-image-input"
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onDrop={handleImageDrop}
                      >
                        <div className="egitmen-panel-dropzone-inner">
                          <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                          <p className="egitmen-panel-dropzone-title">Dosyaları buraya sürükleyin</p>
                          <p className="egitmen-panel-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
                        </div>
                      </label>
                    )}
                    {imageFile ? (
                      <p className="egitmen-panel-announcement-modal-file-hint">{imageFile.name}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="egitmen-panel-announcement-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--cancel"
                onClick={closeModal}
                disabled={saving}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--submit"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
  },
);

function compareAdminAnnouncements(a: AdminAnnouncementRow, b: AdminAnnouncementRow): number {
  const aPublished = a.published_at ? new Date(a.published_at).getTime() : Number.NEGATIVE_INFINITY;
  const bPublished = b.published_at ? new Date(b.published_at).getTime() : Number.NEGATIVE_INFINITY;
  if (aPublished !== bPublished) return bPublished - aPublished;
  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bCreated - aCreated;
}
