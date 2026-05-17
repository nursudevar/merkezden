"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { Heart, Phone, Search, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import LoginModal from '@/components/LoginModal';
import { FavoritesError, getMyFavoriteInstitutionIds, toggleFavorite } from '@/lib/favorites/favoritesClient';
import { getInstitutionDetailHref } from '@/lib/institutionHelpers';
import { resolveUserTypeFromUsersClient } from '@/lib/auth/authBrowserClient';

const PAGE_SIZE = 50;

const COLS = [
  'institution_name',
  'type',
  'city',
  'district',
  'official_phone',
  'address',
] as const;

const COL_LABELS: Record<(typeof COLS)[number], string> = {
  institution_name: 'Kurum Adı',
  type: 'Alt Kategori',
  city: 'Şehir',
  district: 'İlçe',
  official_phone: 'Telefon',
  address: 'Adres',
};

const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildSearchVariants = (rawValue: string): string[] => {
  const value = rawValue.trim();
  if (!value) return [];

  const normalized = normalizeSearchText(value);
  const variants = [
    value,
    value.toLocaleLowerCase('tr-TR'),
    value.toLocaleUpperCase('tr-TR'),
    normalized,
    normalized.toLocaleUpperCase('tr-TR'),
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  return [...new Set(variants)];
};

const escapeLikeValue = (value: string) =>
  value
    // PostgREST `or` filtresini bozan karakterleri nötrleştir
    .replace(/[(),]/g, ' ')
    .replace(/[.%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type InstitutionCategoryRow = { id: number; name: string | null; is_active?: boolean | null };
type InstitutionTypeRow = {
  id: number;
  name: string | null;
  category_id: number;
  is_active?: boolean | null;
};

export default function OkullarPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appUserType, setAppUserType] = useState<string | null>(null);
  const [appUserTypeLoading, setAppUserTypeLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());

  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [categoryRows, setCategoryRows] = useState<Array<{ id: number; name: string }>>([]);
  const [typeRows, setTypeRows] = useState<Array<{ id: number; name: string; category_id: number }>>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isSubcategoryMenuOpen, setIsSubcategoryMenuOpen] = useState(false);
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
  const [isDistrictMenuOpen, setIsDistrictMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const subcategoryMenuRef = useRef<HTMLDivElement | null>(null);
  const cityMenuRef = useRef<HTMLDivElement | null>(null);
  const districtMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 450);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(Math.max(1, newPage)));
      router.push(`/okullar?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [categoryRes, typeRes, cityRes, districtRes] = await Promise.all([
        supabase
          .from('institution_categories')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('institution_types')
          .select('id, name, category_id, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase.from('institutions').select('city').limit(5000),
        supabase.from('institutions').select('district').limit(5000),
      ]);
      if (cancelled) return;
      const cats = (categoryRes.data as InstitutionCategoryRow[] | null) ?? [];
      const types = (typeRes.data as InstitutionTypeRow[] | null) ?? [];
      const nextCats = cats
        .map((c) => ({ id: c.id, name: String(c.name ?? '').trim() }))
        .filter((c) => Boolean(c.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const nextTypes = types
        .map((t) => ({ id: t.id, name: String(t.name ?? '').trim(), category_id: t.category_id }))
        .filter((t) => Boolean(t.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const cityList = [...new Set((cityRes.data ?? []).map((r) => r.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr'));
      const districtList = [...new Set((districtRes.data ?? []).map((r) => r.district).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr'));
      setCategoryRows(nextCats);
      setTypeRows(nextTypes);
      setCities(cityList);
      setDistricts(districtList);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const supabase = createSupabaseBrowserClient();
        const selectCols = `id, slug, source, ${COLS.join(', ')}`;
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const searchTerm = debouncedSearchText.trim();

        let dataQuery = supabase
          .from('institutions')
          .select(selectCols, { count: 'exact' })
          .order('institution_name', { ascending: true })
          .order('id', { ascending: true });

        if (selectedCity) {
          dataQuery = dataQuery.eq('city', selectedCity);
        }
        if (selectedDistrict) {
          dataQuery = dataQuery.eq('district', selectedDistrict);
        }
        if (selectedSubcategoryId) {
          const typeId = Number(selectedSubcategoryId);
          if (Number.isFinite(typeId)) {
            dataQuery = dataQuery.eq('institution_type_id', typeId);
          }
        } else if (selectedCategoryId) {
          const catId = Number(selectedCategoryId);
          const ids = Number.isFinite(catId) ? typeRows.filter((t) => t.category_id === catId).map((t) => t.id) : [];
          if (ids.length === 0) {
            setTotalCount(0);
            setRows([]);
            setLoading(false);
            return;
          }
          dataQuery = dataQuery.in('institution_type_id', ids);
        }
        if (searchTerm) {
          const searchVariants = buildSearchVariants(searchTerm)
            .map(escapeLikeValue)
            .filter(Boolean);

          if (searchVariants.length > 0) {
            const normalizedVariants = searchVariants.map((v) => normalizeSearchText(v));
            const matchedTypeIds = typeRows
              .filter((typeRow) => {
                const name = String(typeRow.name ?? '').trim();
                if (!name) return false;
                const normalizedName = normalizeSearchText(name);
                return normalizedVariants.some(
                  (variant) =>
                    normalizedName.includes(variant) ||
                    variant.includes(normalizedName)
                );
              })
              .map((typeRow) => typeRow.id)
              .filter((id) => Number.isFinite(id));

            const searchColumns = ['institution_name', 'city', 'district', 'official_phone', 'address'] as const;
            const orParts = searchVariants
              .flatMap((term) => {
                const q = `%${term}%`;
                return searchColumns.map((col) => `${col}.ilike.${q}`);
              });

            if (matchedTypeIds.length > 0) {
              orParts.push(`institution_type_id.in.(${matchedTypeIds.join(',')})`);
            }

            dataQuery = dataQuery.or(orParts.join(','));
          }
        }

        const dataRes = await dataQuery.range(from, to);

        if (cancelled) return;

        if (dataRes.error) {
          setError(dataRes.error.message);
          setRows([]);
          setTotalCount(null);
        } else {
          setTotalCount(dataRes.count ?? 0);
          const data = dataRes.data;
          const list = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
          list.sort((a, b) => {
            const na = String(a?.institution_name ?? '');
            const nb = String(b?.institution_name ?? '');
            return na.localeCompare(nb, 'tr');
          });
          setRows(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Bir hata oluştu');
          setRows([]);
          setTotalCount(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, selectedCity, selectedDistrict, selectedCategoryId, selectedSubcategoryId, typeRows, debouncedSearchText]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady) return;
    if (!user?.id) {
      setAppUserType(null);
      setAppUserTypeLoading(false);
      return;
    }
    setAppUserTypeLoading(true);
    resolveUserTypeFromUsersClient(user.id)
      .then((t) => {
        if (cancelled) return;
        setAppUserType(t);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('User type resolve error:', e);
        setAppUserType(null);
      })
      .finally(() => {
        if (!cancelled) setAppUserTypeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user?.id]);

  const showFavoriteColumn = !user || appUserTypeLoading || appUserType === 'individual';

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    (async () => {
      try {
        const ids = await getMyFavoriteInstitutionIds();
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === 'NOT_INDIVIDUAL') {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
        } else {
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

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      window.alert('Favoriler yalnızca bireysel hesaplarda kullanılabilir.');
      return;
    }
    if (favoritesLoading || favoriteActionLoadingIds.has(institutionId)) return;

    const wasFavorited = favoriteIds.has(institutionId);
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
          : 'Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.';
      window.alert(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
        return next;
      });
    }
  };

  const filteredRows = useMemo(() => rows, [rows]);

  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 0;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const startPageNum = totalPages <= 3 ? 1 : Math.max(1, Math.min(page - 1, totalPages - 2));
  const visiblePageNumbers = totalPages <= 3
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [startPageNum, startPageNum + 1, startPageNum + 2].filter((p) => p <= totalPages);

  const [goToPageInput, setGoToPageInput] = useState('');
  const handleGoToPage = () => {
    const num = parseInt(goToPageInput, 10);
    if (num >= 1 && num <= totalPages) setPage(num);
    setGoToPageInput('');
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (page !== 1) setPage(1);
  };
  const handleClearSearch = () => setSearchText('');
  const handleClearAll = () => {
    setSearchText('');
    setSelectedCategoryId('');
    setSelectedSubcategoryId('');
    setSelectedCity('');
    setSelectedDistrict('');
    setPage(1);
  };
  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    setSelectedSubcategoryId('');
    setIsCategoryMenuOpen(false);
    setPage(1);
  };
  const handleSubcategoryChange = (value: string) => {
    setSelectedSubcategoryId(value);
    setIsSubcategoryMenuOpen(false);
    setPage(1);
  };
  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    setIsCityMenuOpen(false);
    setPage(1);
  };
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setIsDistrictMenuOpen(false);
    setPage(1);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!categoryMenuRef.current) return;
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
      if (subcategoryMenuRef.current && !subcategoryMenuRef.current.contains(event.target as Node)) {
        setIsSubcategoryMenuOpen(false);
      }
      if (cityMenuRef.current && !cityMenuRef.current.contains(event.target as Node)) {
        setIsCityMenuOpen(false);
      }
      if (districtMenuRef.current && !districtMenuRef.current.contains(event.target as Node)) {
        setIsDistrictMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  return (
    <div className="page-container">
      <main className="okullar-page">
        <h1 className="okullar-title">Tüm Kurumların Listesi</h1>

        {error && <div className="okullar-error">{error}</div>}

        <div className="okullar-card">
            <div className="okullar-filter-bar">
              <div className="okullar-filter-search-wrap">
                <Search className="okullar-filter-search-icon" size={18} aria-hidden />
                <input
                  type="text"
                  className="okullar-filter-search-input"
                  placeholder="Kurum adı, kategori, şehir, ilçe veya adresle ara..."
                  value={searchText}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  aria-label="Arama"
                />
                {searchText.length > 0 && (
                  <button
                    type="button"
                    className="okullar-filter-search-clear"
                    onClick={handleClearSearch}
                    aria-label="Aramayı temizle"
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              {loading && (
                <span className="okullar-filter-loading" aria-live="polite">
                  Yükleniyor…
                </span>
              )}
              <div className="okullar-category-dropdown" ref={categoryMenuRef}>
                <button
                  type="button"
                  className={`okullar-filter-select okullar-filter-select--category ${isCategoryMenuOpen ? 'okullar-filter-select--open' : ''}`}
                  onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isCategoryMenuOpen}
                  aria-label="Kategori"
                >
                  <span
                    className="okullar-category-dropdown-label"
                    title={categoryRows.find((c) => String(c.id) === selectedCategoryId)?.name || 'Kategori'}
                  >
                    {categoryRows.find((c) => String(c.id) === selectedCategoryId)?.name || 'Kategori'}
                  </span>
                </button>
                {isCategoryMenuOpen && (
                  <div className="okullar-category-dropdown-menu" role="listbox" aria-label="Kategori seçenekleri">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCategoryId === ''}
                      className={`okullar-category-dropdown-option ${selectedCategoryId === '' ? 'okullar-category-dropdown-option--selected' : ''}`}
                      onClick={() => handleCategoryChange('')}
                    >
                      Tüm Kategoriler
                    </button>
                    {categoryRows.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        role="option"
                        aria-selected={selectedCategoryId === String(cat.id)}
                        className={`okullar-category-dropdown-option ${selectedCategoryId === String(cat.id) ? 'okullar-category-dropdown-option--selected' : ''}`}
                        onClick={() => handleCategoryChange(String(cat.id))}
                        title={cat.name}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="okullar-category-dropdown" ref={subcategoryMenuRef}>
                <button
                  type="button"
                  className={`okullar-filter-select okullar-filter-select--category ${isSubcategoryMenuOpen ? 'okullar-filter-select--open' : ''}`}
                  onClick={() => {
                    if (!selectedCategoryId) return;
                    setIsSubcategoryMenuOpen((prev) => !prev);
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={isSubcategoryMenuOpen}
                  aria-label="Alt Kategori"
                  disabled={!selectedCategoryId}
                >
                  <span
                    className="okullar-category-dropdown-label"
                    title={typeRows.find((t) => String(t.id) === selectedSubcategoryId)?.name || 'Alt Kategori'}
                  >
                    {typeRows.find((t) => String(t.id) === selectedSubcategoryId)?.name || 'Alt Kategori'}
                  </span>
                </button>
                {isSubcategoryMenuOpen && (
                  <div className="okullar-category-dropdown-menu" role="listbox" aria-label="Alt kategori seçenekleri">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedSubcategoryId === ''}
                      className={`okullar-category-dropdown-option ${selectedSubcategoryId === '' ? 'okullar-category-dropdown-option--selected' : ''}`}
                      onClick={() => handleSubcategoryChange('')}
                    >
                      Tüm Alt Kategoriler
                    </button>
                    {typeRows
                      .filter((t) => String(t.category_id) === selectedCategoryId)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="option"
                          aria-selected={selectedSubcategoryId === String(t.id)}
                          className={`okullar-category-dropdown-option ${selectedSubcategoryId === String(t.id) ? 'okullar-category-dropdown-option--selected' : ''}`}
                          onClick={() => handleSubcategoryChange(String(t.id))}
                          title={t.name}
                        >
                          {t.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="okullar-generic-dropdown" ref={cityMenuRef}>
                <button
                  type="button"
                  className={`okullar-filter-select ${isCityMenuOpen ? 'okullar-filter-select--open' : ''}`}
                  onClick={() => setIsCityMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isCityMenuOpen}
                  aria-label="Şehir filtrele"
                >
                  <span className="okullar-category-dropdown-label" title={selectedCity || 'Tüm şehirler'}>
                    {selectedCity || 'Tüm şehirler'}
                  </span>
                </button>
                {isCityMenuOpen && (
                  <div className="okullar-category-dropdown-menu" role="listbox" aria-label="Şehir seçenekleri">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedCity === ''}
                      className={`okullar-category-dropdown-option ${selectedCity === '' ? 'okullar-category-dropdown-option--selected' : ''}`}
                      onClick={() => handleCityChange('')}
                    >
                      Tüm şehirler
                    </button>
                    {cities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        role="option"
                        aria-selected={selectedCity === city}
                        className={`okullar-category-dropdown-option ${selectedCity === city ? 'okullar-category-dropdown-option--selected' : ''}`}
                        onClick={() => handleCityChange(city)}
                        title={city}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="okullar-generic-dropdown" ref={districtMenuRef}>
                <button
                  type="button"
                  className={`okullar-filter-select ${isDistrictMenuOpen ? 'okullar-filter-select--open' : ''}`}
                  onClick={() => setIsDistrictMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isDistrictMenuOpen}
                  aria-label="İlçe filtrele"
                >
                  <span className="okullar-category-dropdown-label" title={selectedDistrict || 'Tüm ilçeler'}>
                    {selectedDistrict || 'Tüm ilçeler'}
                  </span>
                </button>
                {isDistrictMenuOpen && (
                  <div className="okullar-category-dropdown-menu" role="listbox" aria-label="İlçe seçenekleri">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedDistrict === ''}
                      className={`okullar-category-dropdown-option ${selectedDistrict === '' ? 'okullar-category-dropdown-option--selected' : ''}`}
                      onClick={() => handleDistrictChange('')}
                    >
                      Tüm ilçeler
                    </button>
                    {districts.map((district) => (
                      <button
                        key={district}
                        type="button"
                        role="option"
                        aria-selected={selectedDistrict === district}
                        className={`okullar-category-dropdown-option ${selectedDistrict === district ? 'okullar-category-dropdown-option--selected' : ''}`}
                        onClick={() => handleDistrictChange(district)}
                        title={district}
                      >
                        {district}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(searchText || selectedCategoryId || selectedSubcategoryId || selectedCity || selectedDistrict) && (
                <button type="button" className="okullar-filter-temizle" onClick={handleClearAll}>
                  Temizle
                </button>
              )}
            </div>
            <div className="okullar-table-wrap">
              <table className={`okullar-table ${showFavoriteColumn ? '' : 'okullar-table--no-fav'}`}>
                <thead>
                  <tr>
                    {showFavoriteColumn ? <th className="okullar-table-fav-col" aria-label="Favoriler" /> : null}
                    {COLS.map((col) => (
                      <th key={col}>{COL_LABELS[col]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length + (showFavoriteColumn ? 1 : 0)} className="okullar-table-empty">
                        {rows.length === 0
                          ? 'Henüz okul kaydı bulunmamaktadır.'
                          : 'Sonuç bulunamadı.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const institutionIdRaw = row.id;
                      const institutionIdString = institutionIdRaw == null ? '' : String(institutionIdRaw).trim();
                      const institutionId = Number(institutionIdRaw);
                      const institutionSlug = String(row.slug ?? '').trim();
                      const institutionSource = String(row.source ?? '');
                      const rowHref = institutionSlug
                        ? getInstitutionDetailHref({ slug: institutionSlug, source: institutionSource })
                        : '';

                      return (
                      <tr
                        key={(row.id as number | string | undefined) ?? idx}
                        className={rowHref ? 'okullar-table-row-clickable' : undefined}
                        onClick={() => {
                          if (!rowHref) return;
                          router.push(rowHref);
                        }}
                      >
                        {showFavoriteColumn ? (
                          <td className="okullar-favorite-cell">
                            {(() => {
                              const isFavorite = Number.isFinite(institutionId) ? favoriteIds.has(institutionId) : false;
                              const isActionLoading = Number.isFinite(institutionId)
                                ? favoriteActionLoadingIds.has(institutionId)
                                : false;
                              return (
                                <motion.button
                                  type="button"
                                  aria-label={isFavorite ? 'Favorilerden kaldır' : 'Favorilere ekle'}
                                  className="featured-institution-favorite"
                                  whileTap={{ scale: 0.9 }}
                                  disabled={isActionLoading || (Boolean(user) && !favoritesEnabled) || !Number.isFinite(institutionId)}
                                  onClick={(e) => handleFavoriteToggle(institutionId, e)}
                                >
                                  <motion.div
                                    animate={{ scale: isFavorite ? [1, 1.3, 1] : 1 }}
                                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                                  >
                                    <Heart
                                      className={
                                        isFavorite ? 'heart-favorite-icon heart-favorite-icon--active' : 'heart-favorite-icon'
                                      }
                                    />
                                  </motion.div>
                                </motion.button>
                              );
                            })()}
                          </td>
                        ) : null}
                        {COLS.map((col) => {
                          const val = row[col];
                          const display = val == null ? '-' : String(val);
                          const isAddress = col === 'address';
                          const isCategory = col === 'type';
                          const isInstitutionName = col === 'institution_name';
                          const isPhone = col === 'official_phone';
                          const isTruncate = col === 'city' || col === 'district';
                          const tdClass = [
                            isAddress && 'okullar-table-address',
                            isTruncate && 'okullar-table-cell-truncate',
                          ].filter(Boolean).join(' ');
                          return (
                            <td
                              key={col}
                              className={tdClass || undefined}
                            >
                              {isCategory && display !== '-' ? (
                                <span className="okullar-category-badge">
                                  {display}
                                </span>
                              ) : isInstitutionName && display !== '-' && institutionIdString ? (
                                <span className="okullar-table-link">{display}</span>
                              ) : isPhone && display !== '-' ? (
                                <span className="okullar-table-phone">
                                  <Phone className="okullar-table-phone-icon" size={12} aria-hidden />
                                  <a
                                    href={`tel:${display}`}
                                    className="okullar-table-phone-link"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {display}
                                  </a>
                                </span>
                              ) : (
                                display
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>

            {(totalCount !== null || rows.length > 0) && (
              <div className="okullar-pagination">
                <div className="okullar-pagination-info">
                  {totalCount !== null && (
                    <>
                      Toplam <strong>{totalCount}</strong> Kurum Görüntüleniyor.
                      {totalPages > 1 && (
                        <span className="okullar-pagination-page-nums">
                          Sayfa {page} / {totalPages}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="okullar-pagination-controls">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={!hasPrev}
                      aria-label="Önceki sayfa"
                      className="okullar-pagination-btn"
                    >
                      ‹
                    </button>
                    {visiblePageNumbers.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`okullar-pagination-num ${p === page ? 'okullar-pagination-num--active' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={!hasNext}
                      aria-label="Sonraki sayfa"
                      className="okullar-pagination-btn"
                    >
                      ›
                    </button>
                    <span className="okullar-pagination-goto">Git</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={goToPageInput}
                      onChange={(e) => setGoToPageInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGoToPage()}
                      className="okullar-pagination-input"
                    />
                    <button type="button" onClick={handleGoToPage} className="okullar-pagination-page-btn">
                      Ara
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
      </main>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
