"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { CloudUpload, FileText, Image as ImageIcon, Trash2, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import {
  INSTRUCTOR_MEDIA_TABLE_MISSING_SQL,
  resolveInstructorCvStoragePath,
  deleteInstructorGalleryMediaClient,
  isValidInstructorCvFile,
  isValidInstructorImageFile,
  loadInstructorGalleryMediaClient,
  uploadInstructorCvClient,
  uploadInstructorGalleryImageClient,
  uploadInstructorProfilePhotoClient,
  type InstructorGalleryMediaRow,
} from "@/lib/instructorMediaClient";

type Props = {
  authUserId: string;
  instructorRow: InstructorProfileRow;
  onInstructorRowChange: (row: InstructorProfileRow) => void;
};

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

  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);

  const [galleryItems, setGalleryItems] = useState<InstructorGalleryMediaRow[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryTableMissing, setGalleryTableMissing] = useState(false);
  const [deletingGalleryId, setDeletingGalleryId] = useState<number | null>(null);

  const profilePictureUrl = String(instructorRow.profile_picture ?? "").trim();
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

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMediaMessage(null);
    setMediaError(null);
    setUploadingProfile(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { row, error } = await uploadInstructorProfilePhotoClient(
        authUserId,
        instructorId,
        file,
        instructorRow.profile_picture,
        supabase,
      );
      if (error) {
        setMediaError(error);
        return;
      }
      if (row) {
        onInstructorRowChange(row);
        setMediaMessage("Profil fotoğrafı güncellendi.");
      }
    } finally {
      setUploadingProfile(false);
    }
  };

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
          setMediaError("Lütfen geçerli bir görsel dosyası seçin.");
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
      setMediaError("Lütfen PDF, DOC veya DOCX formatında bir CV yükleyin.");
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
        setMediaMessage("CV güncellendi.");
      }
    } finally {
      setUploadingCv(false);
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
      setGalleryItems((prev) => prev.filter((row) => row.id !== item.id));
      setMediaMessage("Galeri görseli silindi.");
    } finally {
      setDeletingGalleryId(null);
    }
  };

  return (
    <div className="egitmen-panel-media">
      <p className="egitmen-panel-media-desc">
        Profil fotoğrafı, galeri görselleri ve CV dosyanızı buradan yükleyebilir ve yönetebilirsiniz.
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

      <div className="egitmen-panel-media-upload-grid">
        <div className="egitmen-panel-media-upload-card">
          <div className="egitmen-panel-media-upload-head">
            <div className="egitmen-panel-media-upload-head-text">
              <h4 className="egitmen-panel-media-upload-title">Profil Fotoğrafı</h4>
              <p className="egitmen-panel-media-upload-subtitle">JPEG, PNG veya WEBP (maks. 10MB)</p>
            </div>
            <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
              <User className="egitmen-panel-media-upload-icon" />
            </div>
          </div>
          <label className="egitmen-panel-dropzone">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleProfilePhotoChange(e)}
              disabled={uploadingProfile}
            />
            <div className="egitmen-panel-dropzone-inner">
              <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
              <p className="egitmen-panel-dropzone-title">
                {uploadingProfile ? "Yükleniyor…" : "Dosyayı seçin veya sürükleyin"}
              </p>
            </div>
          </label>
          <div className="egitmen-panel-media-uploaded">
            {profilePictureUrl ? (
              <div className="egitmen-panel-media-preview-wrap">
                <Image
                  src={profilePictureUrl}
                  alt="Profil fotoğrafı"
                  width={120}
                  height={120}
                  className="egitmen-panel-media-preview-img"
                  unoptimized
                />
              </div>
            ) : (
              <p className="egitmen-panel-media-empty-text">Henüz profil fotoğrafı yüklenmedi.</p>
            )}
          </div>
        </div>

        <div className="egitmen-panel-media-upload-card">
          <div className="egitmen-panel-media-upload-head">
            <div className="egitmen-panel-media-upload-head-text">
              <h4 className="egitmen-panel-media-upload-title">Galeri Görselleri</h4>
              <p className="egitmen-panel-media-upload-subtitle">Birden fazla görsel ekleyebilirsiniz</p>
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
                {uploadingGallery ? "Yükleniyor…" : "Galeri için görsel seçin"}
              </p>
            </div>
          </label>
          <div className="egitmen-panel-media-uploaded">
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
              <p className="egitmen-panel-form-loading">Galeri yükleniyor…</p>
            ) : galleryItems.length > 0 ? (
              <div className="egitmen-panel-gallery-grid" role="list" aria-label="Galeri görselleri">
                {galleryItems.map((item) => (
                  <div key={item.id} className="egitmen-panel-gallery-item" role="listitem">
                    {item.file_url ? (
                      <Image
                        src={item.file_url}
                        alt={item.file_name ?? "Galeri görseli"}
                        width={160}
                        height={120}
                        className="egitmen-panel-gallery-item-img"
                        unoptimized
                      />
                    ) : null}
                    <button
                      type="button"
                      className="egitmen-panel-gallery-item-delete"
                      onClick={() => void handleGalleryDelete(item)}
                      disabled={deletingGalleryId === item.id}
                      aria-label="Görseli sil"
                    >
                      <Trash2 size={16} aria-hidden />
                      {deletingGalleryId === item.id ? "…" : "Sil"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="egitmen-panel-media-empty-text">Henüz galeri görseli yüklenmedi.</p>
            )}
          </div>
        </div>
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
            </div>
          ) : (
            <p className="egitmen-panel-media-empty-text">CV eksik</p>
          )}
        </div>
      </div>
    </div>
  );
}
