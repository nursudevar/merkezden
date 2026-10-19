"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InstructorProfileRow } from "@/lib/instructorProfileClient";
import { UploadSuccessModal } from "@/components/ui/UploadSuccessModal";
import {
  INSTRUCTOR_MEDIA_IMAGE_ERROR,
  isValidInstructorImageFile,
  uploadInstructorProfilePhotoClient,
} from "@/lib/instructorMediaClient";

type Props = {
  authUserId: string;
  instructorRow: InstructorProfileRow;
  onInstructorRowChange: (row: InstructorProfileRow) => void;
};

export function InstructorProfilePhotoField({
  authUserId,
  instructorRow,
  onInstructorRowChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const profilePictureUrl = String(instructorRow.profile_picture ?? "").trim();

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isValidInstructorImageFile(file)) {
      setError(INSTRUCTOR_MEDIA_IMAGE_ERROR);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { row, error: uploadError } = await uploadInstructorProfilePhotoClient(
        authUserId,
        instructorRow.id,
        file,
        instructorRow.profile_picture,
        supabase,
      );
      if (uploadError || !row) {
        setError(uploadError ?? INSTRUCTOR_MEDIA_IMAGE_ERROR);
        return;
      }
      onInstructorRowChange(row);
      setSuccessOpen(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="egitmen-panel-profile-photo-wrap">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="egitmen-panel-profile-photo-input"
        aria-label="Profil fotoğrafı yükle"
        onChange={(event) => void handlePhotoChange(event)}
      />
      <div
        className={`egitmen-panel-profile-photo-box ${uploading ? "egitmen-panel-profile-photo-box--uploading" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (uploading) return;
          fileInputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (uploading) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Profil fotoğrafı yükle"
      >
        {uploading ? (
          <>
            <Loader2 className="egitmen-panel-profile-photo-icon egitmen-panel-profile-photo-spinner" aria-hidden />
            <span className="egitmen-panel-profile-photo-loading-text">Yükleniyor…</span>
          </>
        ) : profilePictureUrl ? (
          <img src={profilePictureUrl} alt="" className="egitmen-panel-profile-photo-img" />
        ) : (
          <Upload className="egitmen-panel-profile-photo-icon" aria-hidden />
        )}
        <Upload className="egitmen-panel-profile-photo-hover-icon" aria-hidden />
      </div>
      <span className="egitmen-panel-form-label">Profil Fotoğrafı</span>
      {error ? (
        <span className="egitmen-panel-profile-photo-error" role="alert">
          {error}
        </span>
      ) : null}
      <UploadSuccessModal
        open={successOpen}
        message="Profil fotoğrafı başarıyla yüklendi."
        onClose={() => setSuccessOpen(false)}
      />
    </div>
  );
}
