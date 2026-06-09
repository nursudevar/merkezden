"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CloudUpload, FileText, Image as ImageIcon, Plus } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  createBlogPost,
  fetchBlogCategories,
  fetchMyBlogPosts,
  formatBlogPostDate,
  generateBlogSlug,
  uploadBlogCoverImage,
  type BlogCategory,
  type MyBlogPost,
} from "@/lib/blog/blogClient";
import "@/styles/components/user-blog-posts-panel.scss";

type UserBlogPostsPanelProps = {
  authorType: "individual" | "instructor";
  authorAuthId: string;
  authorFullName: string;
  embedded?: boolean;
};

function buildContentPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function BlogTableThumbCell({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const trimmed = String(url ?? "").trim();
  if (!trimmed || failed) {
    return (
      <div className="panel-media-thumb panel-media-thumb--fallback" aria-hidden>
        <ImageIcon className="panel-media-thumb-icon" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={trimmed}
      alt=""
      className="panel-media-thumb panel-media-thumb--image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function UserBlogPostsPanel({
  authorType,
  authorAuthId,
  authorFullName,
  embedded = false,
}: UserBlogPostsPanelProps) {
  const formId = useId();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<MyBlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    categoryId?: string;
    title?: string;
    content?: string;
    coverImage?: string;
  }>({});
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyBlogPosts(authorAuthId);
      setPosts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blog yazıları yüklenemedi.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [authorAuthId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchBlogCategories();
        if (!cancelled) setCategories(rows);
      } catch {
        if (!cancelled) setError("Kategoriler yüklenemedi.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [coverFile]);

  const resetForm = () => {
    setCategoryId("");
    setTitle("");
    setContent("");
    setCoverFile(null);
    setFormError(null);
    setFormErrors({});
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const handleCoverInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoverFile(file);
    setFormErrors((prev) => ({ ...prev, coverImage: undefined }));
  };

  const handleCoverDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCoverDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file || !file.type.startsWith("image/")) return;
    setCoverFile(file);
    setFormErrors((prev) => ({ ...prev, coverImage: undefined }));
  };

  const handleCoverPickClick = () => {
    if (saving) return;
    coverInputRef.current?.click();
  };

  const handleCoverClear = () => {
    if (saving) return;
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
    setFormErrors((prev) => ({ ...prev, coverImage: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const nextErrors: {
      categoryId?: string;
      title?: string;
      content?: string;
      coverImage?: string;
    } = {};

    if (!categoryId) nextErrors.categoryId = "Kategori seçimi zorunludur.";
    if (!title.trim()) nextErrors.title = "Başlık zorunludur.";
    if (!content.trim()) nextErrors.content = "İçerik zorunludur.";
    if (!coverFile) nextErrors.coverImage = "Kapak görseli zorunludur.";

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFormError(null);
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormErrors({});

    try {
      const uploadResult = await uploadBlogCoverImage(coverFile as File, authorType, authorAuthId);
      if ("error" in uploadResult) {
        setFormError(uploadResult.error);
        return;
      }

      await createBlogPost({
        author_auth_id: authorAuthId,
        author_type: authorType,
        author_full_name: authorFullName,
        category_id: Number.parseInt(categoryId, 10),
        title: title.trim(),
        slug: generateBlogSlug(title),
        content: content.trim(),
        cover_image_url: uploadResult.publicUrl,
        cover_image_path: uploadResult.path,
      });

      setModalOpen(false);
      resetForm();
      setSuccessMessage("Blog yazınız başarıyla oluşturuldu.");
      await loadPosts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Blog yazısı kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const showCoverPreview = Boolean(coverPreviewUrl);

  return (
    <div className={`user-blog-posts-panel ${embedded ? "user-blog-posts-panel--embedded" : ""}`}>
      <div className="panel-main-card-header">
        <div className="panel-main-card-header-left">
          <FileText className="panel-main-card-icon" aria-hidden />
          <h2 className="panel-main-card-title">Blog Yazılarım</h2>
        </div>
        <button
          type="button"
          className="panel-announcements-add-btn"
          onClick={openModal}
          disabled={saving}
        >
          <Plus className="panel-announcements-add-btn-icon" aria-hidden />
          Yeni Blog Yazısı Ekle
        </button>
      </div>

      <div className="panel-announcements-content">
        {successMessage ? (
          <p className="user-blog-posts-message user-blog-posts-message--success" role="status">
            {successMessage}
          </p>
        ) : null}
        {error ? (
          <p className="user-blog-posts-message user-blog-posts-message--error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="panel-main-card-placeholder">Blog yazıları yükleniyor…</p>
        ) : posts.length === 0 ? (
          <p className="panel-main-card-placeholder">
            Henüz blog yazınız bulunmuyor. İlk blog yazınızı ekleyerek yayınlamaya başlayabilirsiniz.
          </p>
        ) : (
          <div className="panel-announcements-table-wrap">
            <table className="panel-announcements-table">
              <thead>
                <tr>
                  <th className="panel-announcements-th panel-announcements-th-image">Görsel</th>
                  <th className="panel-announcements-th">Başlık</th>
                  <th className="panel-announcements-th">Kategori</th>
                  <th className="panel-announcements-th">İçerik</th>
                  <th className="panel-announcements-th">Tarih</th>
                  <th className="panel-announcements-th">Durum</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="panel-announcements-tr">
                    <td className="panel-announcements-td panel-announcements-td-image">
                      <BlogTableThumbCell url={post.cover_image_url} />
                    </td>
                    <td className="panel-announcements-td panel-announcements-td-title">
                      {post.title}
                    </td>
                    <td className="panel-announcements-td">{post.categoryName}</td>
                    <td className="panel-announcements-td panel-announcements-td-desc">
                      <span className="panel-announcements-desc-clamp">
                        {buildContentPreview(post.content) || "-"}
                      </span>
                    </td>
                    <td className="panel-announcements-td">
                      {formatBlogPostDate(post.published_at ?? post.created_at)}
                    </td>
                    <td className="panel-announcements-td">
                      <span
                        className={
                          post.is_published
                            ? "panel-announcements-badge panel-announcements-badge--published"
                            : "panel-announcements-badge panel-announcements-badge--draft"
                        }
                      >
                        {post.is_published ? "Yayında" : "Taslak"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div
          className="panel-announcement-modal-overlay"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${formId}-modal-title`}
        >
          <div
            className="panel-announcement-modal-content"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={`${formId}-modal-title`} className="panel-announcement-modal-title">
              Yeni Blog Yazısı Ekle
            </h2>
            <div className="panel-announcement-modal-body">
              <form id={formId} className="panel-announcement-modal-form" onSubmit={handleSubmit}>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label" htmlFor={`${formId}-category`}>
                    KATEGORİ
                  </label>
                  <select
                    id={`${formId}-category`}
                    className="panel-institution-form-input user-blog-category-select"
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setFormErrors((prev) => ({ ...prev, categoryId: undefined }));
                    }}
                    disabled={saving}
                  >
                    <option value="">Kategori seçin</option>
                    {categories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.categoryId ? (
                    <span className="panel-announcement-modal-error">{formErrors.categoryId}</span>
                  ) : null}
                </div>

                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label" htmlFor={`${formId}-title`}>
                    BAŞLIK
                  </label>
                  <Input
                    id={`${formId}-title`}
                    type="text"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setFormErrors((prev) => ({ ...prev, title: undefined }));
                    }}
                    disabled={saving}
                    className="panel-institution-form-input"
                  />
                  {formErrors.title ? (
                    <span className="panel-announcement-modal-error">{formErrors.title}</span>
                  ) : null}
                </div>

                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label" htmlFor={`${formId}-content`}>
                    İÇERİK
                  </label>
                  <textarea
                    id={`${formId}-content`}
                    className="panel-institution-form-textarea"
                    rows={4}
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value);
                      setFormErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                    disabled={saving}
                  />
                  {formErrors.content ? (
                    <span className="panel-announcement-modal-error">{formErrors.content}</span>
                  ) : null}
                </div>

                <div className="panel-institution-form-field panel-announcement-image-field">
                  <label className="panel-institution-form-label" htmlFor={`${formId}-cover`}>
                    GÖRSEL
                  </label>
                  <input
                    id={`${formId}-cover`}
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="panel-announcement-image-file-input"
                    aria-label="Blog kapak görseli seç"
                    onChange={handleCoverInputChange}
                    disabled={saving}
                  />
                  <div className="panel-media-upload-card panel-media-upload-card--announcement-modal">
                    <div className="panel-media-upload-head">
                      <div className="panel-media-upload-head-text">
                        <h4 className="panel-media-upload-title">Fotoğraf Yükle</h4>
                        <p className="panel-media-upload-subtitle">PNG, JPG veya WEBP (Maks 10MB)</p>
                      </div>
                      <div className="panel-media-upload-icon-wrap" aria-hidden>
                        <ImageIcon className="panel-media-upload-icon" />
                      </div>
                    </div>
                    {showCoverPreview ? (
                      <div
                        className="panel-media-dropzone panel-media-dropzone--announcement-preview"
                        onDragOver={handleCoverDragOver}
                        onDrop={handleCoverDrop}
                      >
                        <img
                          src={coverPreviewUrl!}
                          alt=""
                          className="panel-announcement-dropzone-preview-img"
                        />
                        <div className="panel-announcement-image-preview-overlay">
                          <button
                            type="button"
                            className="panel-announcement-image-preview-btn"
                            onClick={handleCoverPickClick}
                            disabled={saving}
                          >
                            Görseli değiştir
                          </button>
                          <button
                            type="button"
                            className="panel-announcement-image-preview-btn panel-announcement-image-preview-btn--muted"
                            onClick={handleCoverClear}
                            disabled={saving}
                          >
                            Görseli kaldır
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className="panel-media-dropzone"
                        htmlFor={`${formId}-cover`}
                        onDragOver={handleCoverDragOver}
                        onDrop={handleCoverDrop}
                      >
                        <div className="panel-media-dropzone-inner">
                          <CloudUpload className="panel-media-dropzone-icon" aria-hidden />
                          <p className="panel-media-dropzone-title">
                            {saving ? "Kaydediliyor…" : "Dosyaları buraya sürükleyin"}
                          </p>
                          <p className="panel-media-dropzone-subtitle">Veya bilgisayarınızdan seçin</p>
                        </div>
                      </label>
                    )}
                  </div>
                  {formErrors.coverImage ? (
                    <span className="panel-announcement-modal-error">{formErrors.coverImage}</span>
                  ) : null}
                </div>

                {formError ? (
                  <p className="panel-announcement-modal-error" role="alert">
                    {formError}
                  </p>
                ) : null}
              </form>
            </div>
            <div className="panel-announcement-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--cancel"
                onClick={closeModal}
                disabled={saving}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                form={formId}
                variant="default"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--submit"
                disabled={saving}
              >
                {saving ? "Kaydediliyor…" : "Yayınla"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
