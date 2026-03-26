"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@/components/ui";
import {
  MapPin,
  GraduationCap,
  CheckCircle2,
  Star,
  Image as ImageIcon,
  BookOpen,
  Phone,
  Globe,
  Clock,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMebInstitution } from "@/lib/institutions/isMebInstitution";
import ShareButton from "./ShareButton";

type DbInstitutionRow = {
  id: number;
  institution_name: string | null;
  type: string | null;
  institution_type: { name: string | null; category: { name: string | null } | null } | Array<{ name: string | null; category: { name: string | null } | null }> | null;
  city: string | null;
  district: string | null;
  address: string | null;
  official_phone: string | null;
  website: string | null;
  about: string | null;
  logo: string | null;
  is_verified: boolean | null;
  source: string | null;
};

const FALLBACK_LOGO_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'%3E%3Crect width='320' height='320' rx='28' fill='%23F1EEFF'/%3E%3Cpath d='M95 144c0-7.18 5.82-13 13-13h104c7.18 0 13 5.82 13 13v66c0 7.18-5.82 13-13 13H108c-7.18 0-13-5.82-13-13v-66z' fill='%236D5DFC' fill-opacity='.12'/%3E%3Cpath d='M120 176l22-22 20 20 36-36 22 22v38H120v-22z' fill='%236D5DFC' fill-opacity='.45'/%3E%3Ccircle cx='136' cy='156' r='10' fill='%236D5DFC' fill-opacity='.55'/%3E%3C/svg%3E";

export default function DbInstitutionDetailClient({ id }: { id: number }) {
  const router = useRouter();
  const [row, setRow] = useState<DbInstitutionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from("institutions")
        .select("id, institution_name, type, city, district, address, official_phone, website, about, logo, is_verified, source, institution_type:institution_types(name, category:institution_categories(name))")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (qErr) {
        console.error("[institutions][detail][db-query-error]", qErr);
        setRow(null);
        setError("Kurum kaydı yüklenirken bir hata oluştu.");
        setLoading(false);
        return;
      }

      const r = (data as DbInstitutionRow | null) ?? null;
      if (!r) {
        setRow(null);
        setError("Kurum kaydı bulunamadı.");
        setLoading(false);
        return;
      }

      if (isMebInstitution(r.source)) {
        router.replace(`/institutions/meb/${r.id}`);
        return;
      }

      setRow(r);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const logoUrl = useMemo(() => {
    const supabase = createSupabaseBrowserClient();
    const rawLogoPath = (row?.logo ?? "").trim();
    if (!rawLogoPath) {
      console.info("[institutions][detail][logo][raw]", rawLogoPath);
      console.info("[institutions][detail][logo][resolved]", "");
      return "";
    }

    const normalizedLogoPath = rawLogoPath.replace(/^\/+/, "");
    const resolvedUrl =
      supabase.storage.from("institution-logos").getPublicUrl(normalizedLogoPath).data.publicUrl || "";

    console.info("[institutions][detail][logo][raw]", rawLogoPath);
    console.info("[institutions][detail][logo][resolved]", resolvedUrl);
    return resolvedUrl;
  }, [row?.logo]);

  const name = (row?.institution_name ?? "Kurum").trim();
  const location = [row?.city, row?.district].filter(Boolean).join(", ") || "—";
  const institutionTypeRow = Array.isArray(row?.institution_type)
    ? row?.institution_type[0] ?? null
    : row?.institution_type ?? null;
  const categoryName = (institutionTypeRow?.category?.name ?? "").trim();
  const subcategoryName = (institutionTypeRow?.name ?? row?.type ?? "").trim();
  const about = (row?.about ?? "").trim();
  const address = (row?.address ?? "").trim();
  const phone = (row?.official_phone ?? "").trim();
  const website = (row?.website ?? "").trim();
  const emptyText = "Henüz içerik girilmedi.";
  const hasLogo = Boolean((row?.logo ?? "").trim()) && Boolean(logoUrl) && !logoLoadFailed;

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [row?.logo]);

  if (loading) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="institution-detail-page">
        <div className="institution-detail-container">
          <h1 className="institution-name">Kurum Detay Sayfası</h1>
          <p>{error || "Kurum kaydı bulunamadı."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="institution-detail-page">
      <div className="institution-detail-container">
        <nav className="institution-breadcrumb" aria-label="Breadcrumb">
          <div className="institution-breadcrumb-container">
            <Link href="/" className="institution-breadcrumb-link">
              Ana Sayfa
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <Link href="/" className="institution-breadcrumb-link">
              Kurumlar
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <span className="institution-breadcrumb-current">{name}</span>
          </div>
        </nav>

        <Card className="institution-hero">
          <CardContent className="institution-hero-content">
            <div className="institution-hero-main">
              <div className="institution-logo-section">
                <div className="institution-logo-wrapper">
                  {hasLogo ? (
                    <Image
                      src={logoUrl}
                      alt={name}
                      width={160}
                      height={160}
                      className="institution-logo"
                      unoptimized
                      onError={() => setLogoLoadFailed(true)}
                    />
                  ) : (
                    <div className="institution-logo institution-logo-empty">
                      <p>{emptyText}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="institution-info">
                <div className="institution-title-row">
                  <h1 className="institution-name">{name}</h1>
                </div>
                <p className="institution-description">{about || emptyText}</p>
                <div className="institution-meta">
                  <div className="institution-meta-item">
                    <MapPin size={18} />
                    <span>{location}</span>
                  </div>
                  <div className="institution-meta-item">
                    <span className="institution-meta-badge institution-meta-badge--category">
                      {categoryName || "Okul"}
                    </span>
                  </div>
                  <div className="institution-meta-item">
                    <span className="institution-meta-badge institution-meta-badge--subcategory">
                      <GraduationCap size={16} />
                      {subcategoryName || emptyText}
                    </span>
                  </div>
                  {Boolean(row.is_verified) ? (
                    <div className="institution-meta-item institution-meta-verified institution-meta-badge institution-meta-badge--verified">
                      <CheckCircle2 size={18} />
                      <span>Onaylı Kurum</span>
                    </div>
                  ) : null}
                </div>
                <div className="institution-actions">
                  <ShareButton slug={String(row.id)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="institution-tabs-sticky">
          <div className="institution-tabs-list">
            <a href="#overview" className="institution-tab-item institution-tab-active">
              <BookOpen size={20} />
              <span>Genel Bakış</span>
            </a>
            <a href="#gallery" className="institution-tab-item">
              <ImageIcon size={20} />
              <span>Galeri</span>
            </a>
          </div>
        </div>

        <div className="institution-content-grid">
          <div className="institution-main-content">
            <section id="overview" className="institution-section">
              <h2 className="institution-section-title">Hakkımızda</h2>
              <Card className="institution-section-card">
                <CardContent>
                  <div className="institution-about-text">
                    {(about || emptyText).split("\n\n").map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="gallery" className="institution-section">
              <h2 className="institution-section-title">Kurum Galerisi</h2>
              <div className="institution-gallery-grid">
                <div className="institution-gallery-item institution-gallery-main">
                  <div className="institution-gallery-fallback">
                    <div className="institution-gallery-fallback-icon">
                      <GraduationCap size={34} />
                    </div>
                    <p className="institution-gallery-fallback-text">{emptyText}</p>
                  </div>
                </div>
                <div className="institution-gallery-item">
                  <div className="institution-gallery-fallback">
                    <div className="institution-gallery-fallback-icon">
                      <GraduationCap size={30} />
                    </div>
                    <p className="institution-gallery-fallback-text">{emptyText}</p>
                  </div>
                </div>
                <div className="institution-gallery-item">
                  <div className="institution-gallery-fallback">
                    <div className="institution-gallery-fallback-icon">
                      <GraduationCap size={30} />
                    </div>
                    <p className="institution-gallery-fallback-text">{emptyText}</p>
                  </div>
                </div>
              </div>
            </section>

          </div>

          <aside className="institution-sidebar">
            <div className="institution-sidebar-header">
              <Phone size={20} />
              <span>İletişim Bilgileri</span>
            </div>
            <div className="institution-sidebar-body">
              <div className="institution-map-preview">
                {hasLogo ? (
                  <Image
                    src={logoUrl}
                    alt={name}
                    fill
                    className="institution-map-image"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    unoptimized
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  <div className="institution-map-preview-empty">
                    <p>{emptyText}</p>
                  </div>
                )}
              </div>
              <div className="institution-contact-list">
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ADRES</div>
                    <div className="institution-contact-value">{address || emptyText}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">TELEFON</div>
                    <div className="institution-contact-value">{phone || emptyText}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Globe size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">WEB SİTESİ</div>
                    {website ? (
                      <a
                        href={website.startsWith("http") ? website : `https://${website}`}
                        className="institution-contact-value institution-contact-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {website}
                      </a>
                    ) : (
                      <div className="institution-contact-value">{emptyText}</div>
                    )}
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ÇALIŞMA SAATLERİ</div>
                    <div className="institution-contact-value">{emptyText}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

