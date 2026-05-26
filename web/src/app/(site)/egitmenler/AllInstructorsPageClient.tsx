"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PUBLIC_INSTRUCTORS_TABLE,
  fetchPublicInstructorsListClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";

type InstructorListItem = {
  id: number;
  href: string;
  displayName: string;
  branch: string;
  school: string;
  imageUrl: string;
  priceLabel: string;
};

function formatInstructorPriceRange(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/\btl\b/i.test(raw)) return raw;
  return `${raw} TL`;
}

function formatInstructorPrice(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${new Intl.NumberFormat("tr-TR").format(value)}₺/saat`;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/[₺]|tl|\/\s*saat/i.test(raw)) return raw;

  const numeric = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${new Intl.NumberFormat("tr-TR").format(numeric)}₺/saat`;
  }

  return raw;
}

function extractInstructorPrice(row: Record<string, unknown>): string {
  const priceRange = formatInstructorPriceRange(row.price_range);
  if (priceRange) return priceRange;

  const candidates = [row.price, row.hourly_price, row.lesson_price, row.price_text];
  for (const candidate of candidates) {
    const formatted = formatInstructorPrice(candidate);
    if (formatted) return formatted;
  }

  return "";
}

function mapInstructorRowToCardItem(
  row: PublicInstructorRow & Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): InstructorListItem | null {
  const displayName = publicInstructorDisplayName(row);
  const hrefKey = String(row.slug ?? row.id ?? "").trim();
  if (!displayName || !hrefKey || !row.id) return null;

  return {
    id: Number(row.id),
    href: `/egitmenler/${encodeURIComponent(hrefKey)}`,
    displayName,
    branch: String(row.branch ?? "").trim(),
    school: String(row.school ?? "").trim(),
    imageUrl: resolvePublicInstructorProfilePictureUrl(
      String(row.profile_picture ?? "").trim(),
      supabase,
    ),
    priceLabel: extractInstructorPrice(row),
  };
}

export function AllInstructorsPageClient() {
  const [items, setItems] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from(PUBLIC_INSTRUCTORS_TABLE)
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .order("surname", { ascending: true })
        .limit(1000);

      if (cancelled) return;

      if (error || !Array.isArray(data)) {
        const fallback = await fetchPublicInstructorsListClient({
          limit: 1000,
          supabase,
        });
        if (cancelled) return;

        if (fallback.error) {
          setLoadError(fallback.error.message);
          setLoading(false);
          return;
        }

        const mappedFallback = fallback.rows
          .map((row) =>
            mapInstructorRowToCardItem(
              row as PublicInstructorRow & Record<string, unknown>,
              supabase,
            ),
          )
          .filter((item): item is InstructorListItem => item !== null);

        setItems(mappedFallback);
        setLoading(false);
        return;
      }

      const mapped = (data as Array<Record<string, unknown>>)
        .map((row) =>
          mapInstructorRowToCardItem(
            row as PublicInstructorRow & Record<string, unknown>,
            supabase,
          ),
        )
        .filter((item): item is InstructorListItem => item !== null);

      setItems(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="public-instructors-page">
      <header className="public-instructors-page-header">
        <h1 className="public-instructors-page-title">Tüm Eğitmenler</h1>
        <p className="public-instructors-page-subtitle">
          Platformdaki bireysel eğitmenleri tek sayfada inceleyin ve size en uygun olan profili seçin.
        </p>
      </header>

      {loading ? (
        <p className="public-instructors-page-empty">Eğitmenler yükleniyor...</p>
      ) : loadError ? (
        <p className="public-instructors-page-empty">{loadError}</p>
      ) : items.length === 0 ? (
        <p className="public-instructors-page-empty">Henüz listelenecek eğitmen bulunmuyor.</p>
      ) : (
        <div className="public-instructors-page-grid">
          {items.map((item) => {
            const showImage = Boolean(item.imageUrl) && !brokenImageIds.has(item.id);
            return (
              <Link key={item.id} href={item.href} className="home-individual-instructor-card">
                <div className="home-individual-instructor-card-media">
                  {showImage ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.displayName}
                      fill
                      className="home-individual-instructor-card-image"
                      sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      unoptimized
                      onError={() =>
                        setBrokenImageIds((prev) => {
                          const next = new Set(prev);
                          next.add(item.id);
                          return next;
                        })
                      }
                    />
                  ) : (
                    <div className="home-individual-instructor-card-fallback" aria-hidden>
                      <GraduationCap size={34} />
                    </div>
                  )}
                </div>

                <div className="home-individual-instructor-card-body">
                  {item.branch ? (
                    <span className="home-individual-instructor-card-branch">{item.branch}</span>
                  ) : null}
                  <h2 className="home-individual-instructor-card-name">{item.displayName}</h2>
                  {item.school ? (
                    <p className="home-individual-instructor-card-school">{item.school}</p>
                  ) : null}
                  {item.priceLabel ? (
                    <p className="home-individual-instructor-card-price">{item.priceLabel}</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
