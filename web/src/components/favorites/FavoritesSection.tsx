"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Building2, User as UserIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInstitutionDetailHref, resolveInstitutionLogoPublicUrl } from "@/lib/institutionHelpers";
import { Card, CardContent } from "@/components/ui";
import {
  FavoritesError,
  getMyFavoriteInstitutions,
  getMyFavoriteInstructors,
  removeFavorite,
  removeInstructorFavorite,
  type FavoriteInstitution,
  type FavoriteInstructor,
} from "@/lib/favorites/favoritesClient";

export function FavoritesSection() {
  const [favorites, setFavorites] = useState<FavoriteInstitution[]>([]);
  const [instructorFavorites, setInstructorFavorites] = useState<FavoriteInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [instructorActionLoadingIds, setInstructorActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<number>>(() => new Set());
  const [brokenInstructorImageIds, setBrokenInstructorImageIds] = useState<Set<number>>(() => new Set());

  const normalizedFavorites = useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    return favorites.map((inst) => {
      const logoUrl = resolveInstitutionLogoPublicUrl(supabase, inst.logo);
      return { ...inst, logoUrl: logoUrl || null };
    });
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [list, instructorList] = await Promise.all([
          getMyFavoriteInstitutions(),
          getMyFavoriteInstructors(),
        ]);
        if (cancelled) return;
        setFavorites(list);
        setInstructorFavorites(instructorList);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof FavoritesError ? err.message : "Favoriler yüklenemedi. Lütfen tekrar deneyin.";
        setError(msg);
        setFavorites([]);
        setInstructorFavorites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (institutionId: number) => {
    if (actionLoadingIds.has(institutionId)) return;
    setActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(institutionId);
      return next;
    });
    const prev = favorites;
    setFavorites((cur) => cur.filter((i) => i.id !== institutionId));
    try {
      await removeFavorite(institutionId);
    } catch (err) {
      setFavorites(prev);
      const msg =
        err instanceof FavoritesError ? err.message : "Favorilerden kaldırılamadı. Lütfen tekrar deneyin.";
      setError(msg);
      window.alert(msg);
    } finally {
      setActionLoadingIds((prevSet) => {
        const next = new Set(prevSet);
        next.delete(institutionId);
        return next;
      });
    }
  };

  const handleRemoveInstructor = async (instructorId: number) => {
    if (instructorActionLoadingIds.has(instructorId)) return;
    setInstructorActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(instructorId);
      return next;
    });
    const prev = instructorFavorites;
    setInstructorFavorites((cur) => cur.filter((i) => i.id !== instructorId));
    try {
      await removeInstructorFavorite(instructorId);
    } catch (err) {
      setInstructorFavorites(prev);
      const msg =
        err instanceof FavoritesError ? err.message : "Favorilerden kaldırılamadı. Lütfen tekrar deneyin.";
      setError(msg);
      window.alert(msg);
    } finally {
      setInstructorActionLoadingIds((prevSet) => {
        const next = new Set(prevSet);
        next.delete(instructorId);
        return next;
      });
    }
  };

  return (
    <section className="favorites-section">
      <div className="favorites-section-header">
        <div className="favorites-section-header-left">
          <Heart className="favorites-section-icon" />
          <h2 className="favorites-section-title">Favoriler</h2>
        </div>
      </div>

      {loading ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Favoriler yükleniyor…</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : favorites.length === 0 && instructorFavorites.length === 0 ? (
        <div className="favorites-section-grid">
          <Card className="favorite-card">
            <CardContent className="favorite-card-content">
              <div className="favorite-card-body">
                <p className="favorite-card-description">Henüz favori kurum veya eğitmen eklemediniz.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="favorites-subsection">
            <h3 className="favorites-subsection-title">Favori Kurumlarım</h3>
            {favorites.length === 0 ? (
              <p className="favorites-subsection-empty">Henüz favori kurum eklemediniz.</p>
            ) : (
              <div className="favorites-section-grid">
                {normalizedFavorites.map((inst) => {
                  const title = inst.institution_name ?? "Kurum";
                  const desc =
                    inst.address ||
                    inst.about ||
                    `${inst.city ?? ""}${inst.district ? ` / ${inst.district}` : ""}` ||
                    "—";
                  const category = (inst.categoryName ?? "").trim();
                  const city = (inst.city ?? "").trim();
                  const district = (inst.district ?? "").trim();
                  const locationLabel = [city, district].filter(Boolean).join(" / ");
                  const canRenderLogo = Boolean(inst.logoUrl) && !brokenLogoIds.has(inst.id);
                  const detailHref = getInstitutionDetailHref({ slug: inst.slug });
                  return (
                    <Link
                      key={inst.id}
                      href={detailHref}
                      className="favorite-card"
                      aria-label={`${title} detayları`}
                    >
                      <CardContent className="favorite-card-content">
                        <div className="favorite-card-image-wrapper">
                          {canRenderLogo ? (
                            <img
                              src={inst.logoUrl ?? ""}
                              alt={title}
                              className="favorite-card-logo"
                              onError={() =>
                                setBrokenLogoIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(inst.id);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div className="favorite-card-placeholder" aria-label="Logo bulunmuyor">
                              <Building2 size={28} />
                            </div>
                          )}
                          {locationLabel ? <div className="favorite-card-badge">{locationLabel}</div> : null}
                          <button
                            type="button"
                            className="favorite-card-remove"
                            aria-label="Favorilerden kaldır"
                            disabled={actionLoadingIds.has(inst.id)}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleRemove(inst.id);
                            }}
                          >
                            <Heart className="favorite-card-remove-icon" />
                          </button>
                        </div>
                        <div className="favorite-card-body">
                          <h3 className="favorite-card-title">{title}</h3>
                          {category ? <div className="favorite-card-category-inline">{category}</div> : null}
                          <p className="favorite-card-description">{desc}</p>
                        </div>
                      </CardContent>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="favorites-subsection">
            <h3 className="favorites-subsection-title">Favori Eğitmenlerim</h3>
            {instructorFavorites.length === 0 ? (
              <p className="favorites-subsection-empty">Henüz favori eğitmen eklemediniz.</p>
            ) : (
              <div className="favorites-section-grid">
                {instructorFavorites.map((instructor) => {
                  const canRenderImage =
                    Boolean(instructor.profilePictureUrl) && !brokenInstructorImageIds.has(instructor.id);
                  const meta = [instructor.branch, instructor.school].filter(Boolean).join(" · ");
                  return (
                    <Link
                      key={instructor.id}
                      href={instructor.detailUrl}
                      className="favorite-card"
                      aria-label={`${instructor.name} detayları`}
                    >
                      <CardContent className="favorite-card-content">
                        <div className="favorite-card-image-wrapper">
                          {canRenderImage ? (
                            <img
                              src={instructor.profilePictureUrl ?? ""}
                              alt={instructor.name}
                              className="favorite-card-logo"
                              onError={() =>
                                setBrokenInstructorImageIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(instructor.id);
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <div
                              className="favorite-card-placeholder"
                              aria-label="Profil fotoğrafı bulunmuyor"
                            >
                              <UserIcon size={28} />
                            </div>
                          )}
                          {instructor.location ? (
                            <div className="favorite-card-badge">{instructor.location}</div>
                          ) : null}
                          <button
                            type="button"
                            className="favorite-card-remove"
                            aria-label="Favorilerden kaldır"
                            disabled={instructorActionLoadingIds.has(instructor.id)}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleRemoveInstructor(instructor.id);
                            }}
                          >
                            <Heart className="favorite-card-remove-icon" />
                          </button>
                        </div>
                        <div className="favorite-card-body">
                          <h3 className="favorite-card-title">{instructor.name}</h3>
                          {instructor.title ? (
                            <div className="favorite-card-category-inline">{instructor.title}</div>
                          ) : null}
                          <p className="favorite-card-description">
                            {meta || instructor.priceRange || instructor.location || "—"}
                          </p>
                        </div>
                      </CardContent>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
