"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, PencilLine, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  createHomepageBanner,
  deleteHomepageBanner,
  deleteHomepageBannerStorageObject,
  fetchHomepageBannersForAdmin,
  HOMEPAGE_BANNER_IMAGE_MAX_BYTES,
  HOMEPAGE_BANNER_VIDEO_MAX_BYTES,
  isValidHomepageBannerImageFile,
  isValidHomepageBannerVideoFile,
  normalizeHomepageBannerDisplayOrders,
  resolveHomepageBannerMediaType,
  setHomepageBannerActiveState,
  updateHomepageBanner,
  uploadHomepageBannerImage,
  uploadHomepageBannerVideo,
  type HomepageBannerMediaType,
  type HomepageBannerRow,
} from "@/lib/homeBannersClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type BannerFormState = {
  title: string;
  description: string;
  isActive: boolean;
  mediaType: HomepageBannerMediaType;
};

type BannerFieldErrors = {
  image?: string;
  video?: string;
  title?: string;
  description?: string;
};

type BannerModalMode = "create" | "edit";

const EMPTY_FORM: BannerFormState = {
  title: "",
  description: "",
  isActive: true,
  mediaType: "image",
};

function useAdminModalBackdropClose() {
  const pointerDownOnBackdropRef = useRef(false);

  const onBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownOnBackdropRef.current = event.target === event.currentTarget;
  }, []);

  const getBackdropClickHandler = useCallback((onClose: () => void) => {
    return (event: React.MouseEvent<HTMLDivElement>) => {
      if (pointerDownOnBackdropRef.current && event.target === event.currentTarget) {
        onClose();
      }
      pointerDownOnBackdropRef.current = false;
    };
  }, []);

  return { onBackdropPointerDown, getBackdropClickHandler };
}

function resolveBannerTitle(row: HomepageBannerRow): string {
  return String(row.title ?? "").trim();
}

function resolveBannerDescription(row: HomepageBannerRow): string {
  return String(row.description ?? "").trim();
}

export function AdminHomepageBannersTab() {
  const { onBackdropPointerDown, getBackdropClickHandler } = useAdminModalBackdropClose();

  const [banners, setBanners] = useState<HomepageBannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalMode, setModalMode] = useState<BannerModalMode | null>(null);
  const [editingBanner, setEditingBanner] = useState<HomepageBannerRow | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [existingVideoPath, setExistingVideoPath] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BannerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HomepageBannerRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [draggedBannerId, setDraggedBannerId] = useState<string | null>(null);
  const [dragOverBannerId, setDragOverBannerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const objectPreviewUrlRef = useRef<string | null>(null);
  const videoObjectPreviewUrlRef = useRef<string | null>(null);

  const clearObjectPreviewUrl = useCallback(() => {
    if (objectPreviewUrlRef.current) {
      URL.revokeObjectURL(objectPreviewUrlRef.current);
      objectPreviewUrlRef.current = null;
    }
  }, []);

  const clearVideoObjectPreviewUrl = useCallback(() => {
    if (videoObjectPreviewUrlRef.current) {
      URL.revokeObjectURL(videoObjectPreviewUrlRef.current);
      videoObjectPreviewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearObjectPreviewUrl();
      clearVideoObjectPreviewUrl();
    };
  }, [clearObjectPreviewUrl, clearVideoObjectPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadBanners = async () => {
      setLoading(true);
      setListError(null);

      const { rows, error } = await fetchHomepageBannersForAdmin(supabase);
      if (cancelled) return;

      if (error) {
        setBanners([]);
        setListError(error);
      } else {
        setBanners(rows);
      }
      setLoading(false);
    };

    void loadBanners();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refreshList = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const resetModalState = useCallback(() => {
    clearObjectPreviewUrl();
    clearVideoObjectPreviewUrl();
    setModalMode(null);
    setEditingBanner(null);
    setForm(EMPTY_FORM);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setExistingImageUrl(null);
    setExistingImagePath(null);
    setSelectedVideoFile(null);
    setVideoPreviewUrl(null);
    setExistingVideoUrl(null);
    setExistingVideoPath(null);
    setFieldErrors({});
    setFormError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = "";
    }
  }, [clearObjectPreviewUrl, clearVideoObjectPreviewUrl]);

  const handleOpenCreate = () => {
    resetModalState();
    setModalMode("create");
    setForm(EMPTY_FORM);
  };

  const handleOpenEdit = (row: HomepageBannerRow) => {
    clearObjectPreviewUrl();
    clearVideoObjectPreviewUrl();
    setModalMode("edit");
    setEditingBanner(row);
    setForm({
      title: resolveBannerTitle(row),
      description: resolveBannerDescription(row),
      isActive: row.is_active !== false,
      mediaType: resolveHomepageBannerMediaType(row.media_type),
    });
    setSelectedImageFile(null);
    setImagePreviewUrl(String(row.image_url ?? "").trim() || null);
    setExistingImageUrl(String(row.image_url ?? "").trim() || null);
    setExistingImagePath(row.image_path);
    setSelectedVideoFile(null);
    const resolvedVideoUrl = String(row.video_url ?? "").trim() || null;
    setVideoPreviewUrl(resolvedVideoUrl);
    setExistingVideoUrl(resolvedVideoUrl);
    setExistingVideoPath(row.video_path);
    setFieldErrors({});
    setFormError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = "";
    }
  };

  const handleCloseModal = () => {
    if (saving) return;
    resetModalState();
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setFormError(null);

    if (!file) {
      setSelectedImageFile(null);
      clearObjectPreviewUrl();
      setImagePreviewUrl(existingImageUrl);
      return;
    }

    if (!isValidHomepageBannerImageFile(file)) {
      setSelectedImageFile(null);
      setFieldErrors((prev) => ({
        ...prev,
        image: "Yalnızca JPG, PNG ve WEBP görselleri yüklenebilir.",
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > HOMEPAGE_BANNER_IMAGE_MAX_BYTES) {
      setSelectedImageFile(null);
      setFieldErrors((prev) => ({
        ...prev,
        image: "Görsel en fazla 10MB olabilir.",
      }));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    clearObjectPreviewUrl();
    const preview = URL.createObjectURL(file);
    objectPreviewUrlRef.current = preview;
    setSelectedImageFile(file);
    setImagePreviewUrl(preview);
  };

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFieldErrors((prev) => ({ ...prev, video: undefined }));
    setFormError(null);

    if (!file) {
      setSelectedVideoFile(null);
      clearVideoObjectPreviewUrl();
      setVideoPreviewUrl(existingVideoUrl);
      return;
    }

    if (!isValidHomepageBannerVideoFile(file)) {
      setSelectedVideoFile(null);
      setFieldErrors((prev) => ({
        ...prev,
        video: "Yalnızca MP4 ve WEBM videoları yüklenebilir.",
      }));
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > HOMEPAGE_BANNER_VIDEO_MAX_BYTES) {
      setSelectedVideoFile(null);
      setFieldErrors((prev) => ({
        ...prev,
        video: "Video en fazla 10MB olabilir.",
      }));
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = "";
      }
      return;
    }

    clearVideoObjectPreviewUrl();
    const preview = URL.createObjectURL(file);
    videoObjectPreviewUrlRef.current = preview;
    setSelectedVideoFile(file);
    setVideoPreviewUrl(preview);
  };

  const handleMediaTypeChange = (mediaType: HomepageBannerMediaType) => {
    setFieldErrors((prev) => ({ ...prev, video: undefined }));
    setFormError(null);
    setForm((prev) => ({ ...prev, mediaType }));
  };

  const validateForm = (): {
    title: string;
    description: string;
    mediaType: HomepageBannerMediaType;
  } | null => {
    const title = form.title.trim();
    const description = form.description.trim();
    const mediaType = form.mediaType;
    const hasExistingImage = Boolean(existingImageUrl?.trim());
    const hasImage =
      modalMode === "create"
        ? Boolean(selectedImageFile)
        : Boolean(selectedImageFile || hasExistingImage);
    const hasExistingVideo = Boolean(existingVideoUrl?.trim());
    const hasVideo =
      mediaType === "video"
        ? modalMode === "create"
          ? Boolean(selectedVideoFile)
          : Boolean(selectedVideoFile || hasExistingVideo)
        : true;

    const nextFieldErrors: BannerFieldErrors = {};

    if (!hasImage) {
      nextFieldErrors.image = "Görsel zorunludur.";
    }
    if (mediaType === "video" && !hasVideo) {
      nextFieldErrors.video = "Video zorunludur.";
    }
    if (!title) {
      nextFieldErrors.title = "Başlık zorunludur.";
    }
    if (!description) {
      nextFieldErrors.description = "Açıklama zorunludur.";
    }

    setFieldErrors(nextFieldErrors);
    setFormError(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return null;
    }

    return { title, description, mediaType };
  };

  const handleSave = async () => {
    if (saving) return;

    const validated = validateForm();
    if (!validated) return;

    const { title, description, mediaType } = validated;

    setSaving(true);
    setFormError(null);

    const supabase = createSupabaseBrowserClient();
    let nextImageUrl = existingImageUrl?.trim() ?? "";
    let nextImagePath = existingImagePath;
    let nextVideoUrl = mediaType === "video" ? existingVideoUrl?.trim() ?? "" : "";
    let nextVideoPath = mediaType === "video" ? existingVideoPath : null;
    let uploadedImageDuringSave = false;
    let uploadedVideoDuringSave = false;

    try {
      if (selectedImageFile) {
        const uploadResult = await uploadHomepageBannerImage(
          supabase,
          selectedImageFile,
          editingBanner?.id ?? null,
        );

        if ("error" in uploadResult) {
          setFieldErrors((prev) => ({ ...prev, image: uploadResult.error }));
          return;
        }

        nextImageUrl = uploadResult.publicUrl;
        nextImagePath = uploadResult.path;
        uploadedImageDuringSave = true;
      }

      if (mediaType === "video" && selectedVideoFile) {
        const uploadResult = await uploadHomepageBannerVideo(
          supabase,
          selectedVideoFile,
          editingBanner?.id ?? null,
        );

        if ("error" in uploadResult) {
          if (uploadedImageDuringSave) {
            await deleteHomepageBannerStorageObject(supabase, nextImageUrl, nextImagePath);
          }
          setFieldErrors((prev) => ({ ...prev, video: uploadResult.error }));
          return;
        }

        nextVideoUrl = uploadResult.publicUrl;
        nextVideoPath = uploadResult.path;
        uploadedVideoDuringSave = true;
      }

      const payload = {
        title,
        description,
        imageUrl: nextImageUrl,
        imagePath: nextImagePath,
        mediaType,
        videoUrl: mediaType === "video" ? nextVideoUrl : null,
        videoPath: mediaType === "video" ? nextVideoPath : null,
        isActive: form.isActive,
      };

      if (modalMode === "create") {
        const { success, error } = await createHomepageBanner(supabase, payload);
        if (!success || error) {
          if (uploadedImageDuringSave) {
            await deleteHomepageBannerStorageObject(supabase, nextImageUrl, nextImagePath);
          }
          if (uploadedVideoDuringSave) {
            await deleteHomepageBannerStorageObject(supabase, nextVideoUrl, nextVideoPath);
          }
          setFormError(error?.message ?? "Banner kaydedilemedi.");
          return;
        }
      } else if (modalMode === "edit" && editingBanner) {
        const previousImageUrl = editingBanner.image_url;
        const previousImagePath = editingBanner.image_path;
        const previousVideoUrl = editingBanner.video_url;
        const previousVideoPath = editingBanner.video_path;
        const { error } = await updateHomepageBanner(supabase, editingBanner.id, payload);
        if (error) {
          if (uploadedImageDuringSave) {
            await deleteHomepageBannerStorageObject(supabase, nextImageUrl, nextImagePath);
          }
          if (uploadedVideoDuringSave) {
            await deleteHomepageBannerStorageObject(supabase, nextVideoUrl, nextVideoPath);
          }
          setFormError(error.message);
          return;
        }

        if (selectedImageFile) {
          await deleteHomepageBannerStorageObject(
            supabase,
            previousImageUrl,
            previousImagePath,
          );
        }

        if (mediaType === "image") {
          await deleteHomepageBannerStorageObject(
            supabase,
            previousVideoUrl,
            previousVideoPath,
          );
        } else if (selectedVideoFile) {
          await deleteHomepageBannerStorageObject(
            supabase,
            previousVideoUrl,
            previousVideoPath,
          );
        }
      }

      resetModalState();
      refreshList();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: HomepageBannerRow) => {
    if (togglingActiveId) return;

    setTogglingActiveId(row.id);
    setListError(null);

    const supabase = createSupabaseBrowserClient();
    const nextActive = row.is_active === false;
    const { error } = await setHomepageBannerActiveState(supabase, row.id, nextActive);

    if (error) {
      setListError(error);
    } else {
      setBanners((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, is_active: nextActive } : item)),
      );
    }

    setTogglingActiveId(null);
  };

  const handleRequestDelete = (row: HomepageBannerRow) => {
    setDeleteError(null);
    setDeleteTarget(row);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);
    setDeleteError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await deleteHomepageBanner(supabase, deleteTarget);

    if (error) {
      setDeleteError(error);
    } else {
      setDeleteTarget(null);
      refreshList();
    }

    setDeletingId(null);
  };

  const persistBannerOrder = async (orderedRows: HomepageBannerRow[]) => {
    setReordering(true);
    setListError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await normalizeHomepageBannerDisplayOrders(
      supabase,
      orderedRows.map((row) => row.id),
    );

    if (error) {
      setListError(error);
      refreshList();
    } else {
      setBanners(orderedRows.map((row, index) => ({ ...row, display_order: index })));
    }

    setReordering(false);
  };

  const handleDragStart = (bannerId: string) => {
    setDraggedBannerId(bannerId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>, bannerId: string) => {
    event.preventDefault();
    if (draggedBannerId && draggedBannerId !== bannerId) {
      setDragOverBannerId(bannerId);
    }
  };

  const handleDrop = (targetBannerId: string) => {
    if (!draggedBannerId || draggedBannerId === targetBannerId || reordering) {
      setDraggedBannerId(null);
      setDragOverBannerId(null);
      return;
    }

    const draggedIndex = banners.findIndex((row) => row.id === draggedBannerId);
    const targetIndex = banners.findIndex((row) => row.id === targetBannerId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedBannerId(null);
      setDragOverBannerId(null);
      return;
    }

    const nextRows = [...banners];
    const [moved] = nextRows.splice(draggedIndex, 1);
    nextRows.splice(targetIndex, 0, moved);

    setBanners(nextRows);
    setDraggedBannerId(null);
    setDragOverBannerId(null);
    void persistBannerOrder(nextRows);
  };

  const handleDragEnd = () => {
    setDraggedBannerId(null);
    setDragOverBannerId(null);
  };

  const modalTitle = modalMode === "create" ? "Yeni Banner" : "Banner Düzenle";

  const deleteMessage = useMemo(() => {
    if (!deleteTarget) return "";
    const title = resolveBannerTitle(deleteTarget) || "Bu banner";
    return `${title} kaydını silmek istediğinize emin misiniz?`;
  }, [deleteTarget]);

  return (
    <>
      <Card className="admin-main-card">
        <CardContent className="admin-main-card-content admin-main-card-content--homepage-banners">
          <div className="admin-main-card-header admin-main-card-header--homepage-banners">
            <div className="admin-homepage-banners-header-left">
              <h1 className="admin-main-card-title">Banner Yönetimi</h1>
              <span className="admin-homepage-banners-total-badge">
                {`${banners.length.toLocaleString("tr-TR")} TOPLAM`}
              </span>
            </div>
            <div className="admin-homepage-banners-header-actions">
              <button
                type="button"
                className="admin-homepage-banners-add-btn"
                onClick={handleOpenCreate}
              >
                <Plus size={16} aria-hidden />
                <span>Yeni Banner</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-homepage-banners-empty">Yükleniyor...</div>
          ) : listError && banners.length === 0 ? (
            <div className="admin-homepage-banners-empty admin-homepage-banners-empty--error">
              {listError}
            </div>
          ) : banners.length === 0 ? (
            <div className="admin-homepage-banners-empty">
              Henüz banner eklenmemiş. Yeni bir banner oluşturmak için &quot;Yeni Banner&quot;
              butonunu kullanın.
            </div>
          ) : (
            <>
              {listError ? (
                <p className="admin-homepage-banners-inline-error" role="alert">
                  {listError}
                </p>
              ) : null}
              {reordering ? (
                <p className="admin-homepage-banners-inline-note">Sıralama kaydediliyor...</p>
              ) : (
                <p className="admin-homepage-banners-inline-note">
                  Sıralamayı değiştirmek için satırı tutup sürükleyin.
                </p>
              )}
              <div className="admin-homepage-banners-table-wrap">
                <table className="admin-homepage-banners-table">
                  <colgroup>
                    <col className="admin-homepage-banners-col-drag" />
                    <col className="admin-homepage-banners-col-image" />
                    <col className="admin-homepage-banners-col-title" />
                    <col className="admin-homepage-banners-col-description" />
                    <col className="admin-homepage-banners-col-status" />
                    <col className="admin-homepage-banners-col-action" />
                    <col className="admin-homepage-banners-col-action" />
                    <col className="admin-homepage-banners-col-action" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th aria-label="Sürükle" />
                      <th>Görsel</th>
                      <th>Başlık</th>
                      <th>Açıklama</th>
                      <th>Durum</th>
                      <th>Düzenle</th>
                      <th>Aktif/Pasif</th>
                      <th>Sil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banners.map((row, index) => {
                      const title = resolveBannerTitle(row) || "-";
                      const description = resolveBannerDescription(row) || "-";
                      const imageUrl = String(row.image_url ?? "").trim();
                      const isDragging = draggedBannerId === row.id;
                      const isDragOver = dragOverBannerId === row.id;

                      return (
                        <tr
                          key={row.id}
                          draggable={!reordering}
                          onDragStart={() => handleDragStart(row.id)}
                          onDragOver={(event) => handleDragOver(event, row.id)}
                          onDrop={() => handleDrop(row.id)}
                          onDragEnd={handleDragEnd}
                          className={[
                            "admin-homepage-banners-row",
                            isDragging ? "admin-homepage-banners-row--dragging" : "",
                            isDragOver ? "admin-homepage-banners-row--drag-over" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <td className="admin-homepage-banners-drag-cell">
                            <span
                              className="admin-homepage-banners-drag-handle"
                              aria-label={`${index + 1}. sıradaki bannerı taşı`}
                            >
                              <GripVertical size={16} aria-hidden />
                            </span>
                          </td>
                          <td>
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={title}
                                width={96}
                                height={54}
                                className="admin-homepage-banners-thumb"
                                unoptimized
                              />
                            ) : (
                              <span className="admin-homepage-banners-thumb-placeholder">-</span>
                            )}
                          </td>
                          <td>
                            <span className="admin-homepage-banners-table-clip" title={title}>
                              {title}
                            </span>
                          </td>
                          <td>
                            <span
                              className="admin-homepage-banners-table-clip"
                              title={description}
                            >
                              {description}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                row.is_active !== false
                                  ? "admin-homepage-banners-status-badge admin-homepage-banners-status-badge--active"
                                  : "admin-homepage-banners-status-badge"
                              }
                            >
                              {row.is_active !== false ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="admin-homepage-banners-table-action-cell">
                            <button
                              type="button"
                              className="admin-homepage-banners-action-btn"
                              onClick={() => handleOpenEdit(row)}
                              aria-label="Banner düzenle"
                            >
                              <PencilLine size={16} />
                            </button>
                          </td>
                          <td className="admin-homepage-banners-table-action-cell">
                            <button
                              type="button"
                              className="admin-homepage-banners-action-btn admin-homepage-banners-action-btn--toggle"
                              onClick={() => void handleToggleActive(row)}
                              disabled={togglingActiveId === row.id}
                              aria-label={row.is_active !== false ? "Banner pasifleştir" : "Banner aktifleştir"}
                            >
                              {row.is_active !== false ? "Pasifleştir" : "Aktifleştir"}
                            </button>
                          </td>
                          <td className="admin-homepage-banners-table-action-cell">
                            <button
                              type="button"
                              className="admin-homepage-banners-action-btn admin-homepage-banners-action-btn--danger"
                              onClick={() => handleRequestDelete(row)}
                              disabled={deletingId === row.id}
                              aria-label="Banner sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {modalMode ? (
        <div
          className="admin-homepage-banners-modal-overlay"
          role="presentation"
          onPointerDown={onBackdropPointerDown}
          onClick={getBackdropClickHandler(handleCloseModal)}
        >
          <div
            className="admin-homepage-banners-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-homepage-banners-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-homepage-banners-modal-header">
              <h2 id="admin-homepage-banners-modal-title" className="admin-homepage-banners-modal-title">
                {modalTitle}
              </h2>
              <button
                type="button"
                className="admin-homepage-banners-modal-close-btn"
                onClick={handleCloseModal}
                disabled={saving}
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="admin-homepage-banners-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSave();
              }}
            >
              <div className="admin-homepage-banners-modal-field">
                <span>Medya Türü</span>
                <div
                  className="admin-homepage-banners-modal-media-type"
                  role="radiogroup"
                  aria-label="Medya türü"
                >
                  <label className="admin-homepage-banners-modal-media-type-option">
                    <input
                      type="radio"
                      name="banner-media-type"
                      value="image"
                      checked={form.mediaType === "image"}
                      onChange={() => handleMediaTypeChange("image")}
                    />
                    <span>Görsel</span>
                  </label>
                  <label className="admin-homepage-banners-modal-media-type-option">
                    <input
                      type="radio"
                      name="banner-media-type"
                      value="video"
                      checked={form.mediaType === "video"}
                      onChange={() => handleMediaTypeChange("video")}
                    />
                    <span>Video</span>
                  </label>
                </div>
              </div>
              <div className="admin-homepage-banners-modal-field">
                <span>Görsel</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleImageFileChange}
                />
                <p className="admin-homepage-banners-modal-hint">
                  {form.mediaType === "video"
                    ? "Video poster/fallback görseli — JPG, PNG veya WEBP, en fazla 10MB"
                    : "JPG, PNG veya WEBP — en fazla 10MB"}
                </p>
                {fieldErrors.image ? (
                  <p className="admin-homepage-banners-modal-field-error">{fieldErrors.image}</p>
                ) : null}
                {imagePreviewUrl ? (
                  <div className="admin-homepage-banners-modal-preview">
                    <Image
                      src={imagePreviewUrl}
                      alt="Banner önizleme"
                      width={480}
                      height={160}
                      className="admin-homepage-banners-modal-preview-image"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
              {form.mediaType === "video" ? (
                <div className="admin-homepage-banners-modal-field">
                  <span>Video</span>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,.mp4,.webm"
                    onChange={handleVideoFileChange}
                  />
                  <p className="admin-homepage-banners-modal-hint">MP4 veya WEBM — en fazla 10MB</p>
                  {fieldErrors.video ? (
                    <p className="admin-homepage-banners-modal-field-error">{fieldErrors.video}</p>
                  ) : null}
                  {videoPreviewUrl ? (
                    <div className="admin-homepage-banners-modal-preview">
                      <video
                        src={videoPreviewUrl}
                        className="admin-homepage-banners-modal-preview-video"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className="admin-homepage-banners-modal-field">
                <span>Başlık</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => {
                    setFieldErrors((prev) => ({ ...prev, title: undefined }));
                    setFormError(null);
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }));
                  }}
                />
                {fieldErrors.title ? (
                  <p className="admin-homepage-banners-modal-field-error">{fieldErrors.title}</p>
                ) : null}
              </label>
              <label className="admin-homepage-banners-modal-field">
                <span>Açıklama</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => {
                    setFieldErrors((prev) => ({ ...prev, description: undefined }));
                    setFormError(null);
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }));
                  }}
                />
                {fieldErrors.description ? (
                  <p className="admin-homepage-banners-modal-field-error">{fieldErrors.description}</p>
                ) : null}
              </label>
              <label className="admin-homepage-banners-modal-field admin-homepage-banners-modal-field--checkbox">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                <span>Aktif</span>
              </label>
              {formError ? (
                <p className="admin-homepage-banners-modal-error">{formError}</p>
              ) : null}
              <div className="admin-homepage-banners-modal-actions">
                <button
                  type="button"
                  className="admin-homepage-banners-modal-cancel-btn"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="admin-homepage-banners-modal-save-btn"
                  disabled={saving}
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Banner Sil"
        message={deleteMessage}
        error={deleteError}
        confirmLabel="Sil"
        loading={deletingId !== null}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (deletingId) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
