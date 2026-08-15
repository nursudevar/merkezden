"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FavoritesError,
  getMyFavoriteInstitutionIds,
  getMyFavoriteInstructorIds,
  NOT_INDIVIDUAL_FAVORITES_MESSAGE,
  toggleFavorite,
  toggleInstructorFavorite,
} from "@/lib/favorites/favoritesClient";

export function useListingFavorites() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorIds, setFavoriteInstructorIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [favoriteInstructorActionLoadingIds, setFavoriteInstructorActionLoadingIds] = useState<Set<number>>(
    () => new Set(),
  );

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError(NOT_INDIVIDUAL_FAVORITES_MESSAGE);
      return;
    }
    if (favoriteActionLoadingIds.has(institutionId)) return;

    const wasFavorited = favoriteIds.has(institutionId);
    setFavoritesError(null);
    setFavoriteActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(institutionId);
      return next;
    });
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(institutionId);
      else next.add(institutionId);
      return next;
    });

    try {
      const res = await toggleFavorite(institutionId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
    } catch (err) {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
        return next;
      });
    }
  };

  const handleInstructorFavoriteToggle = async (instructorId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      setFavoritesError(NOT_INDIVIDUAL_FAVORITES_MESSAGE);
      return;
    }
    if (favoriteInstructorActionLoadingIds.has(instructorId)) return;

    const wasFavorited = favoriteInstructorIds.has(instructorId);
    setFavoritesError(null);
    setFavoriteInstructorActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(instructorId);
      return next;
    });
    setFavoriteInstructorIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(instructorId);
      else next.add(instructorId);
      return next;
    });

    try {
      const res = await toggleInstructorFavorite(instructorId);
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
    } catch (err) {
      setFavoriteInstructorIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(instructorId);
        else next.delete(instructorId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
    } finally {
      setFavoriteInstructorActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(instructorId);
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setIsAuthReady(true);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoriteInstructorIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoritesError(null);
      setFavoriteActionLoadingIds(new Set());
      setFavoriteInstructorActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    (async () => {
      try {
        const [ids, instructorIds] = await Promise.all([
          getMyFavoriteInstitutionIds(),
          getMyFavoriteInstructorIds(),
        ]);
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
        setFavoriteInstructorIds(new Set(instructorIds));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
          setFavoriteInstructorIds(new Set());
        } else {
          const msg =
            err instanceof FavoritesError ? err.message : "Favoriler yüklenemedi. Lütfen tekrar deneyin.";
          setFavoritesError(msg);
          setFavoritesEnabled(false);
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  return {
    user,
    showLoginModal,
    setShowLoginModal,
    favoriteIds,
    favoriteInstructorIds,
    favoritesEnabled: favoritesEnabled && !favoritesLoading,
    favoritesError,
    setFavoritesError,
    favoriteActionLoadingIds,
    favoriteInstructorActionLoadingIds,
    handleFavoriteToggle,
    handleInstructorFavoriteToggle,
  };
}
