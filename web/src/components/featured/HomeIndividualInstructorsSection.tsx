"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PUBLIC_INSTRUCTORS_TABLE,
  fetchPublicInstructorsListClient,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import { resolvePublicInstructorProfilePictureUrl } from "@/lib/publicInstructorDetailClient";

const HOME_INSTRUCTOR_LIMIT = 6;

type HomeInstructorCardItem = {
  id: number;
  href: string;
  displayName: string;
  branch: string;
  school: string;
  imageUrl: string;
  priceLabel: string;
};

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
  const candidates = [
    row.price,
    row.hourly_price,
    row.lesson_price,
    row.price_text,
    row.price_range,
  ];

  for (const candidate of candidates) {
    const formatted = formatInstructorPrice(candidate);
    if (formatted) return formatted;
  }

  return "";
}

function mapInstructorRowToCardItem(
  row: PublicInstructorRow & Record<string, unknown>,
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): HomeInstructorCardItem | null {
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

export function HomeIndividualInstructorsSection() {
  const [items, setItems] = useState<HomeInstructorCardItem[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from(PUBLIC_INSTRUCTORS_TABLE)
        .select("*")
        .eq("is_active", true)
        .order("id", { ascending: false })
        .limit(HOME_INSTRUCTOR_LIMIT);

      if (cancelled) return;

      if (error || !Array.isArray(data)) {
        const fallback = await fetchPublicInstructorsListClient({
          limit: HOME_INSTRUCTOR_LIMIT,
          supabase,
        });
        if (cancelled) return;
        const mappedFallback = fallback.rows
          .map((row) =>
            mapInstructorRowToCardItem(
              row as PublicInstructorRow & Record<string, unknown>,
              supabase,
            ),
          )
          .filter((item): item is HomeInstructorCardItem => item !== null);
        setItems(mappedFallback);
        return;
      }

      const mapped = (data as Array<Record<string, unknown>>)
        .map((row) =>
          mapInstructorRowToCardItem(
            row as PublicInstructorRow & Record<string, unknown>,
            supabase,
          ),
        )
        .filter((item): item is HomeInstructorCardItem => item !== null);

      setItems(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(() => items.slice(0, HOME_INSTRUCTOR_LIMIT), [items]);

  if (visibleItems.length === 0) return null;

  return (
    <section className="home-individual-instructors-section" aria-labelledby="home-individual-instructors-title">
      <div className="home-individual-instructors-header">
        <h2 className="home-individual-instructors-title" id="home-individual-instructors-title">
          Bireysel Eğitmenler
        </h2>
        <p className="home-individual-instructors-subtitle">
          Alanında uzman eğitmenleri keşfedin, size en uygun eğitmeni kolayca bulun.
        </p>
      </div>

      <div className="home-individual-instructors-grid">
        {visibleItems.map((item) => {
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
                    sizes="(max-width: 767px) 120px, (max-width: 1023px) 145px, 155px"
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
                <h3 className="home-individual-instructor-card-name">{item.displayName}</h3>
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
    </section>
  );
}
