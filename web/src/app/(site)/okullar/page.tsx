"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Phone, Search, X } from 'lucide-react';

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
  type: 'Kategori',
  city: 'Şehir',
  district: 'İlçe',
  official_phone: 'Telefon',
  address: 'Adres',
};

function normalizeForSearch(s: string): string {
  return s.trim().toLocaleLowerCase('tr');
}

function rowMatchesSearch(row: Record<string, unknown>, searchNorm: string): boolean {
  if (!searchNorm) return true;
  for (const col of COLS) {
    const val = row[col];
    const str = val != null ? String(val) : '';
    if (normalizeForSearch(str).includes(searchNorm)) return true;
  }
  return false;
}

export default function OkullarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

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
      const [cityRes, districtRes] = await Promise.all([
        supabase.from('institutions').select('city').limit(5000),
        supabase.from('institutions').select('district').limit(5000),
      ]);
      if (cancelled) return;
      const cityList = [...new Set((cityRes.data ?? []).map((r) => r.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr'));
      const districtList = [...new Set((districtRes.data ?? []).map((r) => r.district).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr'));
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
        const selectCols = COLS.join(', ');
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let countQuery = supabase.from('institutions').select('*', { count: 'exact', head: true });
        let dataQuery = supabase
          .from('institutions')
          .select(selectCols)
          .order('institution_name', { ascending: true })
          .order('id', { ascending: true });

        if (selectedCity) {
          countQuery = countQuery.eq('city', selectedCity);
          dataQuery = dataQuery.eq('city', selectedCity);
        }
        if (selectedDistrict) {
          countQuery = countQuery.eq('district', selectedDistrict);
          dataQuery = dataQuery.eq('district', selectedDistrict);
        }

        const [countRes, dataRes] = await Promise.all([
          countQuery,
          dataQuery.range(from, to),
        ]);

        if (cancelled) return;

        if (countRes.error) {
          setError(countRes.error.message);
          setRows([]);
          setTotalCount(null);
        } else {
          setTotalCount(countRes.count ?? 0);
          if (dataRes.error) {
            setError(dataRes.error.message);
            setRows([]);
          } else {
            const data = dataRes.data;
            const list = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : [];
            list.sort((a, b) => {
              const na = String(a?.institution_name ?? '');
              const nb = String(b?.institution_name ?? '');
              return na.localeCompare(nb, 'tr');
            });
            setRows(list);
          }
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
  }, [page, selectedCity, selectedDistrict]);

  const searchNorm = useMemo(() => normalizeForSearch(searchText), [searchText]);
  const filteredRows = useMemo(
    () => (searchNorm ? rows.filter((row) => rowMatchesSearch(row, searchNorm)) : rows),
    [rows, searchNorm]
  );

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
  };
  const handleClearSearch = () => setSearchText('');
  const handleClearAll = () => {
    setSearchText('');
    setSelectedCity('');
    setSelectedDistrict('');
    setPage(1);
  };
  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    setPage(1);
  };
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setPage(1);
  };

  return (
    <div className="page-container">
      <main className="okullar-page">
        <h1 className="okullar-title">Tüm Kurumların Listesi</h1>

        {error && <div className="okullar-error">{error}</div>}

        {loading ? (
          <p className="okullar-loading">Yükleniyor...</p>
        ) : (
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
              <select
                className="okullar-filter-select"
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                aria-label="Şehir filtrele"
              >
                <option value="">Tüm şehirler</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="okullar-filter-select"
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                aria-label="İlçe filtrele"
              >
                <option value="">Tüm ilçeler</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {(searchText || selectedCity || selectedDistrict) && (
                <button type="button" className="okullar-filter-temizle" onClick={handleClearAll}>
                  Temizle
                </button>
              )}
            </div>
            <div className="okullar-table-wrap">
              <table className="okullar-table">
                <thead>
                  <tr>
                    {COLS.map((col) => (
                      <th key={col}>{COL_LABELS[col]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS.length} className="okullar-table-empty">
                        {rows.length === 0
                          ? 'Henüz okul kaydı bulunmamaktadır.'
                          : 'Sonuç bulunamadı.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr key={(row.id as string) ?? idx}>
                        {COLS.map((col) => {
                          const val = row[col];
                          const display = val == null ? '-' : String(val);
                          const isAddress = col === 'address';
                          const isCategory = col === 'type';
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
                              title={isTruncate && display !== '-' ? display : undefined}
                            >
                              {isCategory && display !== '-' ? (
                                <span className="okullar-category-badge" title={display}>
                                  {display}
                                </span>
                              ) : isPhone && display !== '-' ? (
                                <span className="okullar-table-phone">
                                  <Phone className="okullar-table-phone-icon" size={12} aria-hidden />
                                  <a href={`tel:${display}`} className="okullar-table-phone-link">
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
                    ))
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
        )}
      </main>
    </div>
  );
}
