"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudUpload, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_MEDIA_CV_ERROR,
  INSTRUCTOR_MEDIA_CV_SUCCESS,
  INSTRUCTOR_MEDIA_GALLERY_DELETE_SUCCESS,
  INSTRUCTOR_MEDIA_IMAGE_ERROR,
  INSTRUCTOR_MEDIA_TABLE_MISSING_SQL,
  resolveInstructorCvStoragePath,
  deleteInstructorCvClient,
  deleteInstructorGalleryMediaClient,
  isValidInstructorCvFile,
  isValidInstructorImageFile,
  loadInstructorGalleryMediaClient,
  uploadInstructorCvClient,
  uploadInstructorGalleryImageClient,
  type InstructorGalleryMediaRow,
} from "@/lib/instructorMediaClient";

type Props = {
  authUserId: string;
  instructorRow: InstructorProfileRow;
  onInstructorRowChange: (row: InstructorProfileRow) => void;
};

function formatGalleryFileSize(bytes: number | null | undefined): string {
  if (!bytes || !Number.isFinite(bytes)) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function cvDisplayFileName(cvPath: string): string {
  const path = resolveInstructorCvStoragePath(cvPath) ?? String(cvPath ?? "").trim();
  if (!path) return "";
  const segment = path.split("/").pop() ?? path;
  const withoutTimestamp = segment.match(/^\d+-(.+)$/);
  return withoutTimestamp ? withoutTimestamp[1] : segment;
}

export function InstructorMediaTab({ authUserId, instructorRow, onInstructorRowChange }: Props) {
  const instructorId = instructorRow.id;

  const [mediaMessage, setMediaMessage] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);

  const [galleryItems, setGalleryItems] = useState<InstructorGalleryMediaRow[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryTableMissing, setGalleryTableMissing] = useState(false);
  const [deletingGalleryId, setDeletingGalleryId] = useState<number | null>(null);
  const [deletingCv, setDeletingCv] = useState(false);

  const cvPath = String(instructorRow.cv_url ?? "").trim();
  const hasCv = Boolean(cvPath);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { items, tableMissing, error } = await loadInstructorGalleryMediaClient(
      authUserId,
      instructorId,
      supabase,
    );
    setGalleryItems(items);
    setGalleryTableMissing(tableMissing);
    if (error) setMediaError(error);
    setGalleryLoading(false);
  }, [authUserId, instructorId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const handleGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (galleryTableMissing) return;

    setMediaMessage(null);
    setMediaError(null);
    setUploadingGallery(true);
    try {
      const supabase = createSupabaseBrowserClient();
      let uploaded = 0;
      for (const file of files) {
        if (!isValidInstructorImageFile(file)) {
          setMediaError(INSTRUCTOR_MEDIA_IMAGE_ERROR);
          continue;
        }
        const { item, tableMissing, error } = await uploadInstructorGalleryImageClient(
          authUserId,
          instructorId,
          file,
          supabase,
        );
        if (tableMissing) {
          setGalleryTableMissing(true);
          setMediaError("Galeri tablosu bulunamadı. Lütfen yöneticinize başvurun.");
          break;
        }
        if (error) {
          setMediaError(error);
          continue;
        }
        if (item) {
          setGalleryItems((prev) => [item, ...prev]);
          uploaded += 1;
        }
      }
      if (uploaded > 0) {
        await loadGallery();
        setMediaMessage(
          uploaded === 1 ? "Galeri görseli yüklendi." : `${uploaded} galeri görseli yüklendi.`,
        );
      }
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isValidInstructorCvFile(file)) {
      setMediaError(INSTRUCTOR_MEDIA_CV_ERROR);
      return;
    }

    setMediaMessage(null);
    setMediaError(null);
    setUploadingCv(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { row, error } = await uploadInstructorCvClient(
        authUserId,
        instructorId,
        file,
        instructorRow.cv_url,
        supabase,
      );
      if (error) {
        setMediaError(error);
        return;
      }
      if (row) {
        onInstructorRowChange(row);
        setMediaMessage(INSTRUCTOR_MEDIA_CV_SUCCESS);
      }
    } finally {
      setUploadingCv(false);
    }
  };

  const handleCvDelete = async () => {
    if (!hasCv) return;

    setMediaMessage(null);
    setMediaError(null);
    setDeletingCv(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { row, error } = await deleteInstructorCvClient(
        authUserId,
        instructorId,
        instructorRow.cv_url,
        supabase,
      );
      if (error) {
        setMediaError(error);
        return;
      }
      if (row) {
        onInstructorRowChange(row);
        setMediaMessage("CV silindi.");
      }
    } finally {
      setDeletingCv(false);
    }
  };

  const handleGalleryDelete = async (item: InstructorGalleryMediaRow) => {
    setMediaMessage(null);
    setMediaError(null);
    setDeletingGalleryId(item.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await deleteInstructorGalleryMediaClient(
        authUserId,
        instructorId,
        item,
        supabase,
      );
      if (error) {
        setMediaError(error);
        return;
      }
      await loadGallery();
      setMediaMessage(INSTRUCTOR_MEDIA_GALLERY_DELETE_SUCCESS);
    } finally {
      setDeletingGalleryId(null);
    }
  };

  return (
    <div className="egitmen-panel-media">
      <p className="egitmen-panel-media-desc">
        Galeri görsellerinizi ve CV dosyanızı buradan yükleyebilir, görüntüleyebilir ve
        yönetebilirsiniz.
      </p>

      {mediaMessage ? (
        <p className="egitmen-panel-save-message" role="status">
          {mediaMessage}
        </p>
      ) : null}
      {mediaError ? (
        <p className="egitmen-panel-save-message egitmen-panel-save-message--error" role="alert">
          {mediaError}
        </p>
      ) : null}

      <div className="egitmen-panel-media-upload-card">
        <div className="egitmen-panel-media-upload-head">
          <div className="egitmen-panel-media-upload-head-text">
            <h4 className="egitmen-panel-media-upload-title">Fotoğraf Yükle</h4>
            <p className="egitmen-panel-media-upload-subtitle">PNG, JPG veya WEBP (Maks 10MB)</p>
          </div>
          <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
            <ImageIcon className="egitmen-panel-media-upload-icon" />
          </div>
        </div>
        <label className="egitmen-panel-dropzone">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => void handleGalleryChange(e)}
            disabled={uploadingGallery || galleryTableMissing}
          />
          <div className="egitmen-panel-dropzone-inner">
            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
            <p className="egitmen-panel-dropzone-title">
              {uploadingGallery ? "Yükleniyor..." : "Görsel seçmek için tıklayın"}
            </p>
            <p className="egitmen-panel-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
          </div>
        </label>
      </div>

      <div className="egitmen-panel-media-list-card">
        <div className="egitmen-panel-media-list-head">
          <h4 className="egitmen-panel-media-list-title">Medya Listesi</h4>
          <p className="egitmen-panel-media-list-subtitle">
            Yüklediğiniz galeri görselleri burada listelenir.
          </p>
        </div>

        {galleryTableMissing ? (
          <div className="egitmen-panel-media-table-missing">
            <p className="egitmen-panel-media-table-missing-text">
              Galeri için <code>public.instructor_media</code> tablosu bulunamadı. Aşağıdaki SQL
              ile oluşturulmalıdır:
            </p>
            <pre className="egitmen-panel-media-table-missing-sql">
              {INSTRUCTOR_MEDIA_TABLE_MISSING_SQL}
            </pre>
          </div>
        ) : galleryLoading ? (
          <div className="egitmen-panel-media-empty">
            <p className="egitmen-panel-media-empty-text">Yükleniyor...</p>
          </div>
        ) : galleryItems.length === 0 ? (
          <div className="egitmen-panel-media-empty">
            <p className="egitmen-panel-media-empty-text">Henüz medya yüklemesi yapılmamıştır.</p>
          </div>
        ) : (
          <div className="egitmen-panel-media-table-wrap">
            <div className="egitmen-panel-media-table" role="table" aria-label="Galeri görselleri">
              <div className="egitmen-panel-media-row egitmen-panel-media-row--head" role="row">
                <div className="egitmen-panel-media-cell egitmen-panel-media-cell--media" role="columnheader">
                  Medya
                </div>
                <div className="egitmen-panel-media-cell egitmen-panel-media-cell--title" role="columnheader">
                  Başlık
                </div>
                <div className="egitmen-panel-media-cell egitmen-panel-media-cell--type" role="columnheader">
                  Medya Türü
                </div>
                <div className="egitmen-panel-media-cell egitmen-panel-media-cell--size" role="columnheader">
                  Boyut
                </div>
                <div className="egitmen-panel-media-cell egitmen-panel-media-cell--actions" role="columnheader">
                  Sil
                </div>
              </div>
              {galleryItems.map((item) => (
                <div key={item.id} className="egitmen-panel-media-row" role="row">
                  <div className="egitmen-panel-media-cell egitmen-panel-media-cell--media" role="cell">
                    {item.file_url ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name ?? "Galeri görseli"}
                        className="egitmen-panel-media-thumb egitmen-panel-media-thumb--image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="egitmen-panel-media-thumb egitmen-panel-media-thumb--fallback" aria-hidden>
                        <ImageIcon className="egitmen-panel-media-thumb-icon" />
                      </div>
                    )}
                  </div>
                  <div
                    className="egitmen-panel-media-cell egitmen-panel-media-cell--title"
                    role="cell"
                    title={item.file_name?.trim() || undefined}
                  >
                    {item.file_name?.trim() || "—"}
                  </div>
                  <div className="egitmen-panel-media-cell egitmen-panel-media-cell--type" role="cell">
                    <span className="egitmen-panel-media-badge">Görsel</span>
                  </div>
                  <div className="egitmen-panel-media-cell egitmen-panel-media-cell--size" role="cell">
                    {formatGalleryFileSize(item.file_size)}
                  </div>
                  <div className="egitmen-panel-media-cell egitmen-panel-media-cell--actions" role="cell">
                    <button
                      type="button"
                      className="egitmen-panel-media-delete-btn"
                      aria-label="Görseli sil"
                      onClick={() => void handleGalleryDelete(item)}
                      disabled={deletingGalleryId === item.id}
                    >
                      <Trash2 className="egitmen-panel-media-delete-icon" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="egitmen-panel-media-upload-card egitmen-panel-media-cv-block">
        <div className="egitmen-panel-media-upload-head">
          <div className="egitmen-panel-media-upload-head-text">
            <h4 className="egitmen-panel-media-upload-title">CV Dosyası</h4>
            <p className="egitmen-panel-media-upload-subtitle">PDF, DOC veya DOCX (maks. 15MB)</p>
          </div>
          <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
            <FileText className="egitmen-panel-media-upload-icon" />
          </div>
        </div>
        <label className="egitmen-panel-dropzone">
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => void handleCvChange(e)}
            disabled={uploadingCv}
          />
          <div className="egitmen-panel-dropzone-inner">
            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
            <p className="egitmen-panel-dropzone-title">
              {uploadingCv ? "Yükleniyor…" : "CV dosyanızı yükleyin"}
            </p>
            <p className="egitmen-panel-dropzone-subtitle">Kabul edilen formatlar: PDF, DOC, DOCX</p>
          </div>
        </label>
        <div className="egitmen-panel-media-uploaded">
          {hasCv ? (
            <div className="egitmen-panel-cv-list" role="list" aria-label="Yüklenen CV">
              <div className="egitmen-panel-cv-item" role="listitem">
                <div className="egitmen-panel-cv-item-main">
                  <div className="egitmen-panel-cv-item-icon-wrap" aria-hidden>
                    <FileText className="egitmen-panel-cv-item-icon" />
                  </div>
                  <div className="egitmen-panel-cv-item-body">
                    <span className="egitmen-panel-cv-item-name" title={cvDisplayFileName(cvPath)}>
                      {cvDisplayFileName(cvPath)}
                    </span>
                    <span className="egitmen-panel-cv-item-status">CV yüklendi</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="egitmen-panel-media-delete-btn"
                  onClick={() => void handleCvDelete()}
                  disabled={deletingCv || uploadingCv}
                  aria-label="CV dosyasını sil"
                >
                  <Trash2 className="egitmen-panel-media-delete-icon" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <p className="egitmen-panel-media-empty-text">CV eksik</p>
          )}
        </div>
      </div>
    </div>
  );
}
