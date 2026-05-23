"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CloudUpload,
  Image as ImageIcon,
  Megaphone,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  INSTRUCTOR_MEDIA_IMAGE_ERROR,
  isValidInstructorImageFile,
} from "@/lib/instructorMediaClient";
import {
  INSTRUCTOR_ANNOUNCEMENT_CREATE_SUCCESS,
  INSTRUCTOR_ANNOUNCEMENT_DELETE_SUCCESS,
  INSTRUCTOR_ANNOUNCEMENT_ERROR,
  INSTRUCTOR_ANNOUNCEMENT_LINK_URL_ERROR,
  INSTRUCTOR_ANNOUNCEMENT_UPDATE_SUCCESS,
  buildInstructorAnnouncementContentPreview,
  createInstructorAnnouncementClient,
  deleteInstructorAnnouncementClient,
  fetchInstructorAnnouncementsClient,
  formatInstructorAnnouncementDate,
  isValidOptionalAnnouncementLinkUrl,
  normalizeAnnouncementLinkUrl,
  updateInstructorAnnouncementClient,
  type InstructorAnnouncementRow,
} from "@/lib/instructorAnnouncementsClient";
import { Button, Input } from "@/components/ui";

type Props = {
  authUserId: string;
  instructorId: number;
};

type AnnouncementFormState = {
  title: string;
  content: string;
  linkUrl: string;
  isActive: boolean;
};

const EMPTY_FORM: AnnouncementFormState = {
  title: "",
  content: "",
  linkUrl: "",
  isActive: true,
};

function AnnouncementTableThumbCell({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

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

export function InstructorAnnouncementsTab({ authUserId, instructorId }: Props) {
  const [items, setItems] = useState<InstructorAnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{ title?: string; content?: string; linkUrl?: string }>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<InstructorAnnouncementRow | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageRemovePending, setImageRemovePending] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editingRow = useMemo(
    () => (editingId != null ? items.find((row) => row.id === editingId) ?? null : null),
    [editingId, items],
  );

  const editingDbImageUrl = useMemo(() => {
    if (!editingRow) return null;
    const raw = String(editingRow.image_url ?? "").trim();
    return raw || null;
  }, [editingRow]);

  const previewSrc = useMemo(() => {
    if (imageObjectUrl) return imageObjectUrl;
    if (imageRemovePending) return null;
    return editingDbImageUrl;
  }, [imageObjectUrl, imageRemovePending, editingDbImageUrl]);

  const showImagePreview = Boolean(previewSrc);

  useEffect(() => {
    if (!imageFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { items: rows, error: loadError } = await fetchInstructorAnnouncementsClient(
      authUserId,
      instructorId,
      supabase,
    );
    setItems(rows);
    if (loadError) setError(loadError);
    setLoading(false);
  }, [authUserId, instructorId]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving]);

  useEffect(() => {
    if (!deleteConfirmRow) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && deletingId == null) setDeleteConfirmRow(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmRow, deletingId]);

  const openNewModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setImageFile(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setModalOpen(true);
  };

  const openEditModal = (row: InstructorAnnouncementRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      content: row.content,
      linkUrl: String(row.link_url ?? ""),
      isActive: Boolean(row.is_active),
    });
    setFormErrors({});
    setImageFile(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormErrors({});
    setImageFile(null);
    setImageRemovePending(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleFormChange = (field: keyof AnnouncementFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageRemovePending(false);
    if (file && !isValidInstructorImageFile(file)) {
      setError(INSTRUCTOR_MEDIA_IMAGE_ERROR);
      e.target.value = "";
      return;
    }
    setImageFile(file);
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !isValidInstructorImageFile(file)) {
      if (file) setError(INSTRUCTOR_MEDIA_IMAGE_ERROR);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(INSTRUCTOR_ANNOUNCEMENT_ERROR);
      return;
    }
    setImageRemovePending(false);
    setImageFile(file);
  };

  const handleImagePickClick = () => {
    if (saving) return;
    imageInputRef.current?.click();
  };

  const handleImageClearOrRemove = () => {
    if (saving) return;
    if (imageFile) {
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    if (editingDbImageUrl) {
      setImageRemovePending(true);
    }
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const linkRaw = form.linkUrl.trim();
    const errors: { title?: string; content?: string; linkUrl?: string } = {};

    if (!title) errors.title = "Başlık zorunludur.";
    if (!content) errors.content = "İçerik zorunludur.";
    if (linkRaw && !isValidOptionalAnnouncementLinkUrl(linkRaw)) {
      errors.linkUrl = INSTRUCTOR_ANNOUNCEMENT_LINK_URL_ERROR;
    }
    if (imageFile && !isValidInstructorImageFile(imageFile)) {
      setError(INSTRUCTOR_MEDIA_IMAGE_ERROR);
      return;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const link_url = normalizeAnnouncementLinkUrl(linkRaw);

    try {
      if (editingId != null && editingRow) {
        const { row, error: updateError } = await updateInstructorAnnouncementClient(
          authUserId,
          instructorId,
          editingId,
          { image_url: editingRow.image_url, image_path: editingRow.image_path },
          {
            title,
            content,
            link_url,
            is_active: form.isActive,
            imageFile,
            removeImage: imageRemovePending,
          },
          supabase,
        );
        if (updateError) {
          setError(updateError);
          return;
        }
        if (row) {
          setItems((prev) => prev.map((item) => (item.id === row.id ? row : item)));
          setMessage(INSTRUCTOR_ANNOUNCEMENT_UPDATE_SUCCESS);
        }
      } else {
        const { row, error: createError } = await createInstructorAnnouncementClient(
          authUserId,
          instructorId,
          {
            title,
            content,
            link_url,
            is_active: form.isActive,
            imageFile,
          },
          supabase,
        );
        if (createError) {
          setError(createError);
          return;
        }
        if (row) {
          setItems((prev) => [row, ...prev]);
          setMessage(INSTRUCTOR_ANNOUNCEMENT_CREATE_SUCCESS);
        }
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (row: InstructorAnnouncementRow) => {
    setDeleteConfirmRow(row);
  };

  const closeDeleteConfirm = () => {
    if (deletingId != null) return;
    setDeleteConfirmRow(null);
  };

  const handleDeleteConfirm = async () => {
    const row = deleteConfirmRow;
    if (!row || deletingId != null) return;

    setDeletingId(row.id);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error: deleteError } = await deleteInstructorAnnouncementClient(
      authUserId,
      instructorId,
      row,
      supabase,
    );

    if (deleteError) {
      setError(deleteError);
    } else {
      setItems((prev) => prev.filter((item) => item.id !== row.id));
      setMessage(INSTRUCTOR_ANNOUNCEMENT_DELETE_SUCCESS);
      setDeleteConfirmRow(null);
    }

    setDeletingId(null);
  };

  const modalTitle = editingId != null ? "Duyuruyu Düzenle" : "Yeni Duyuru";
  const isBusy = saving || deletingId != null;

  return (
    <>
      <div className="egitmen-panel-announcements-header">
        <div className="egitmen-panel-announcements-header-left">
          <Megaphone className="egitmen-panel-main-card-icon" aria-hidden />
          <div className="egitmen-panel-announcements-header-text">
            <h2 id="instructor-card-title" className="egitmen-panel-main-card-title">
              İçerikler &amp; Duyurular
            </h2>
            <p className="egitmen-panel-announcements-subtitle">
              Eğitmen profilinizde yayınlanacak duyuruları buradan yönetin.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="egitmen-panel-announcements-add-btn"
          onClick={openNewModal}
          disabled={isBusy}
        >
          <Plus className="egitmen-panel-announcements-add-btn-icon" aria-hidden />
          Yeni Duyuru
        </button>
      </div>

      <div className="egitmen-panel-announcements-content">
        {message ? (
          <p className="egitmen-panel-save-message" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
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
              İlk duyurunuzu oluşturarak öğrencilerinize güncel bilgileri aktarabilirsiniz.
            </p>
            <button
              type="button"
              className="egitmen-panel-announcements-add-btn"
              onClick={openNewModal}
              disabled={isBusy}
            >
              <Plus className="egitmen-panel-announcements-add-btn-icon" aria-hidden />
              Yeni Duyuru
            </button>
          </div>
        ) : (
          <div className="egitmen-panel-announcements-table-wrap">
            <table className="egitmen-panel-announcements-table">
              <thead>
                <tr>
                  <th className="egitmen-panel-announcements-th egitmen-panel-announcements-th--image">
                    Görsel
                  </th>
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
                {items.map((row) => (
                  <tr key={row.id} className="egitmen-panel-announcements-tr">
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--image">
                      <AnnouncementTableThumbCell url={row.image_url} />
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--title">
                      {row.title}
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--desc">
                      <span className="egitmen-panel-announcements-desc-clamp">
                        {buildInstructorAnnouncementContentPreview(row.content)}
                      </span>
                    </td>
                    <td className="egitmen-panel-announcements-td">
                      {formatInstructorAnnouncementDate(row.created_at)}
                    </td>
                    <td className="egitmen-panel-announcements-td">
                      <span
                        className={
                          row.is_active
                            ? "egitmen-panel-announcements-badge egitmen-panel-announcements-badge--published"
                            : "egitmen-panel-announcements-badge egitmen-panel-announcements-badge--passive"
                        }
                      >
                        {row.is_active ? "Yayında" : "Pasif"}
                      </span>
                    </td>
                    <td className="egitmen-panel-announcements-td egitmen-panel-announcements-td--actions">
                      <button
                        type="button"
                        className="egitmen-panel-announcements-action-btn"
                        aria-label="Düzenle"
                        onClick={() => openEditModal(row)}
                        disabled={isBusy}
                      >
                        <PencilLine className="egitmen-panel-announcements-action-icon" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="egitmen-panel-announcements-action-btn"
                        aria-label="Sil"
                        onClick={() => openDeleteConfirm(row)}
                        disabled={isBusy || deletingId === row.id}
                      >
                        <Trash2 className="egitmen-panel-announcements-action-icon" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirmRow ? (
        <div
          className="egitmen-panel-confirm-modal-overlay"
          onClick={closeDeleteConfirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="egitmen-delete-confirm-title"
        >
          <div
            className="egitmen-panel-confirm-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="egitmen-delete-confirm-title" className="egitmen-panel-confirm-modal-title">
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
                onClick={closeDeleteConfirm}
                disabled={deletingId != null}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="egitmen-panel-announcement-modal-btn egitmen-panel-announcement-modal-btn--danger"
                onClick={() => void handleDeleteConfirm()}
                disabled={deletingId != null}
              >
                {deletingId != null ? "Siliniyor..." : "Sil"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="egitmen-panel-announcement-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="egitmen-announcement-modal-title"
        >
          <div
            className="egitmen-panel-announcement-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="egitmen-announcement-modal-title" className="egitmen-panel-announcement-modal-title">
              {modalTitle}
            </h2>
            <div className="egitmen-panel-announcement-modal-body">
              <div className="egitmen-panel-announcement-modal-form">
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label">BAŞLIK</label>
                  <Input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange("title", e.target.value)}
                    className="egitmen-panel-form-input"
                    disabled={saving}
                  />
                  {formErrors.title ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.title}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label">İÇERİK</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => handleFormChange("content", e.target.value)}
                    className="egitmen-panel-form-textarea"
                    rows={4}
                    disabled={saving}
                  />
                  {formErrors.content ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.content}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label" htmlFor="egitmen-announcement-link-url">
                    BAĞLANTI LİNKİ
                  </label>
                  <Input
                    id="egitmen-announcement-link-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://"
                    value={form.linkUrl}
                    onChange={(e) => handleFormChange("linkUrl", e.target.value)}
                    className="egitmen-panel-form-input"
                    disabled={saving}
                  />
                  {formErrors.linkUrl ? (
                    <span className="egitmen-panel-announcement-modal-error">{formErrors.linkUrl}</span>
                  ) : null}
                </div>
                <div className="egitmen-panel-form-field">
                  <label className="egitmen-panel-form-label" htmlFor="egitmen-announcement-status">
                    DUYURUNUN AKTİFLİK DURUMU
                  </label>
                  <select
                    id="egitmen-announcement-status"
                    className="egitmen-panel-announcement-status-select"
                    value={form.isActive ? "active" : "inactive"}
                    onChange={(e) => handleFormChange("isActive", e.target.value === "active")}
                    disabled={saving}
                    aria-label="Duyuru durumu"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
                <div className="egitmen-panel-form-field egitmen-panel-announcement-image-field">
                  <input
                    id="egitmen-announcement-image-input"
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
                    {showImagePreview ? (
                      <div
                        className="egitmen-panel-dropzone egitmen-panel-dropzone--announcement-preview"
                        onDragOver={handleImageDragOver}
                        onDrop={handleImageDrop}
                      >
                        <img
                          src={previewSrc!}
                          alt=""
                          className="egitmen-panel-announcement-dropzone-preview-img"
                        />
                        <div className="egitmen-panel-announcement-image-preview-overlay">
                          <button
                            type="button"
                            className="egitmen-panel-announcement-image-preview-btn"
                            onClick={handleImagePickClick}
                            disabled={saving}
                          >
                            Görseli değiştir
                          </button>
                          <button
                            type="button"
                            className="egitmen-panel-announcement-image-preview-btn egitmen-panel-announcement-image-preview-btn--muted"
                            onClick={handleImageClearOrRemove}
                            disabled={saving}
                          >
                            Görseli kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className="egitmen-panel-dropzone"
                        htmlFor="egitmen-announcement-image-input"
                        onDragOver={handleImageDragOver}
                        onDrop={handleImageDrop}
                      >
                        <div className="egitmen-panel-dropzone-inner">
                          <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                          <p className="egitmen-panel-dropzone-title">
                            {saving ? "Kaydediliyor..." : "Dosyaları buraya sürükleyin"}
                          </p>
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
}
