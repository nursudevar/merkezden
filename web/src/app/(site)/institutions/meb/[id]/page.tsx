"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { GraduationCap, MapPin, MapPinned, Phone } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isMebInstitution } from "@/lib/institutions/isMebInstitution";

type InstitutionRow = {
  id: number;
  institution_name: string | null;
  type: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  official_phone: string | null;
  source: string | null;
};

function renderMebFallback(title: string, message: string) {
  return (
    <div className="institution-detail-page institution-detail-page--meb">
      <div className="institution-detail-container">
        <h1 className="institution-name">{title}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default function MebInstitutionDetailPage() {
  const params = useParams<{ id?: string }>();
  const routeId = String(params?.id ?? "").trim();
  const parsedId = Number(routeId);
  const [institution, setInstitution] = useState<InstitutionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invalidRouteParam = useMemo(
    () => !routeId || !Number.isFinite(parsedId),
    [routeId, parsedId]
  );

  useEffect(() => {
    if (invalidRouteParam) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("institutions")
        .select("id, institution_name, type, city, district, address, official_phone, source")
        .eq("id", parsedId)
        .maybeSingle();

      const institutionData = (data as InstitutionRow | null) ?? null;

      if (cancelled) return;

      if (error) {
        setErrorMessage("Kurum kaydı sorgulanırken bir hata oluştu.");
        setInstitution(null);
        setLoading(false);
        console.error("[MEB][detail][query-error]", error);
        return;
      }

      if (!institutionData) {
        setInstitution(null);
        setLoading(false);
        return;
      }

      if (!isMebInstitution(institutionData.source)) {
        setInstitution(institutionData);
        setLoading(false);
        return;
      }

      setInstitution(institutionData);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [invalidRouteParam, parsedId, params?.id, routeId]);

  if (loading) {
    return renderMebFallback("MEB Kurum Detay Sayfası", "Yükleniyor...");
  }

  if (invalidRouteParam) {
    return renderMebFallback(
      "MEB Kurum Detay Sayfası",
      "Kurum kimliği geçerli bir sayı değil."
    );
  }

  if (errorMessage) {
    return renderMebFallback("MEB Kurum Detay Sayfası", errorMessage);
  }

  if (!institution) {
    return renderMebFallback("MEB Kurum Detay Sayfası", "Kurum kaydı bulunamadı.");
  }

  if (!isMebInstitution(institution.source)) {
    return renderMebFallback(
      "MEB Kurum Detay Sayfası",
      "Bu kurum MEB kaynağına ait değil."
    );
  }

  return (
    <div className="institution-detail-page institution-detail-page--meb">
      <div className="institution-detail-container">
        <nav className="institution-breadcrumb" aria-label="Breadcrumb">
          <div className="institution-breadcrumb-container">
            <Link href="/" className="institution-breadcrumb-link">
              Ana Sayfa
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <Link href="/okullar" className="institution-breadcrumb-link">
              Kurumlar
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <span className="institution-breadcrumb-current">
              {institution.institution_name ?? "Kurum"}
            </span>
          </div>
        </nav>

        <Card className="institution-hero">
          <CardContent className="institution-hero-content">
            <div className="institution-hero-main">
              <div className="institution-logo-section">
                <div className="institution-logo-wrapper">
                  <div className="institution-logo institution-logo--meb-fallback">
                    <GraduationCap size={56} />
                  </div>
                </div>
              </div>

              <div className="institution-info">
                <div className="institution-title-row">
                  <h1 className="institution-name">{institution.institution_name ?? "Kurum"}</h1>
                </div>

                {institution.type ? (
                  <div className="institution-meb-type-badge">{institution.type}</div>
                ) : null}

                {institution.city || institution.district ? (
                  <div className="institution-meta">
                    <div className="institution-meta-item">
                      <MapPin size={18} />
                      <span>
                        {[institution.city, institution.district].filter(Boolean).join(" / ")}
                      </span>
                    </div>
                  </div>
                ) : null}

                {institution.official_phone ? (
                  <div className="institution-meta">
                    <div className="institution-meta-item">
                      <Phone size={18} />
                      <a
                        href={`tel:${institution.official_phone}`}
                        className="institution-contact-value institution-contact-link"
                      >
                        {institution.official_phone}
                      </a>
                    </div>
                  </div>
                ) : null}

                {institution.address ? (
                  <div className="institution-meta">
                    <div className="institution-meta-item">
                      <MapPinned size={18} />
                      <span>{institution.address}</span>
                    </div>
                  </div>
                ) : null}

              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

