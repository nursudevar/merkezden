"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Facebook, Twitter, Instagram, Linkedin, ChevronDown } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCategoryHref } from "@/lib/categoryHelpers";

type FooterCategoryRow = { id: number; name: string; slug: string };

export default function Footer() {
  const [footerCategories, setFooterCategories] = useState<FooterCategoryRow[]>([]);
  const [openKurumsal, setOpenKurumsal] = useState(false);
  const [openDestek, setOpenDestek] = useState(false);
  const [openTakip, setOpenTakip] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) return;
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("institution_categories")
        .select("id, name, slug, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (cancelled || error) return;
      const rows = (data ?? [])
        .map((row: { id: number; name: string | null; slug: string | null }) => {
          const name = String(row.name ?? "").trim();
          const slug = String(row.slug ?? "").trim();
          if (!name) return null;
          return { id: row.id, name, slug };
        })
        .filter((row): row is FooterCategoryRow => Boolean(row));
      setFooterCategories(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [isHome]);

  const footerInner = (
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="footer-brand-title-link">
              <Image
                src="/images/merkezden-logo.svg"
                alt="Merkezden"
                width={440}
                height={88}
                className="footer-brand-logo"
              />
            </Link>
            <p className="footer-brand-subtitle">
              Hayatın merkezi, hizmetin adresi. Eğitimden sanata, spordan kariyere uzanan geniş yelpazede aradığınız her şey tek bir platformda.
            </p>
          </div>

          <div className={`footer-section footer-section-accordion ${openKurumsal ? "is-open" : ""}`}>
            <button
              type="button"
              className="footer-section-header"
              aria-expanded={openKurumsal}
              aria-controls="footer-kurumsal"
              id="footer-kurumsal-btn"
              onClick={() => setOpenKurumsal(!openKurumsal)}
            >
              <span className="footer-section-title">Kurumsal</span>
              <ChevronDown className="footer-section-chevron" aria-hidden size={20} />
            </button>
            <div
              id="footer-kurumsal"
              role="region"
              aria-labelledby="footer-kurumsal-btn"
              className="footer-section-content"
            >
              <ul className="footer-section-list">
                <li className="footer-section-item">
                  <Link href="/about">Hakkımızda</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="/contact">İletişim</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="/faq">Sıkça Sorulan Sorular</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className={`footer-section footer-section-accordion ${openDestek ? "is-open" : ""}`}>
            <button
              type="button"
              className="footer-section-header"
              aria-expanded={openDestek}
              aria-controls="footer-destek"
              id="footer-destek-btn"
              onClick={() => setOpenDestek(!openDestek)}
            >
              <span className="footer-section-title">Destek</span>
              <ChevronDown className="footer-section-chevron" aria-hidden size={20} />
            </button>
            <div
              id="footer-destek"
              role="region"
              aria-labelledby="footer-destek-btn"
              className="footer-section-content"
            >
              <ul className="footer-section-list">
                <li className="footer-section-item">
                  <Link href="#">Yardım Merkezi</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="#">Kullanım Şartları</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="#">Gizlilik Politikası</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="#">KVKK</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className={`footer-section footer-section-accordion ${openTakip ? "is-open" : ""}`}>
            <button
              type="button"
              className="footer-section-header"
              aria-expanded={openTakip}
              aria-controls="footer-takip"
              id="footer-takip-btn"
              onClick={() => setOpenTakip(!openTakip)}
            >
              <span className="footer-section-title">Bizi Takip Edin</span>
              <ChevronDown className="footer-section-chevron" aria-hidden size={20} />
            </button>
            <div
              id="footer-takip"
              role="region"
              aria-labelledby="footer-takip-btn"
              className="footer-section-content"
            >
              <div className="footer-social footer-social--section">
                <a href="#" className="footer-social-link" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
                <a href="#" className="footer-social-link" aria-label="Twitter">
                  <Twitter size={18} />
                </a>
                <a href="#" className="footer-social-link" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
                <a href="#" className="footer-social-link" aria-label="LinkedIn">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
          </div>

        </div>
        <div className="footer-divider" />
        <div className="footer-bottom">
          <div className="footer-copyright-row">
            <span className="footer-copyright">© 2023 MERKEZDEN.COM</span>
            <span className="footer-copyright footer-copyright-right">Tüm Hakları Saklıdır.</span>
          </div>
        </div>
      </div>
  );

  if (isHome) {
    return (
      <footer className="footer footer--with-wave">
        <div className="homepage-footer">
          <div className="homepage-footer-wave-top" aria-hidden="true">
            <svg
              viewBox="0 0 1440 160"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0,70 C180,110 360,20 540,45 C720,70 900,130 1080,95 C1260,60 1350,40 1440,55 L1440,160 L0,160 Z"
                fill="#1f2733"
              />
            </svg>
          </div>
          <div className="homepage-footer-extension">
            <div className="homepage-footer-extension-inner">
              <div className="homepage-footer-extension-tags">
                {footerCategories.map((category) => {
                  const href =
                    getCategoryHref(category.name, category.slug) ?? "/okullar";
                  return (
                    <Link
                      key={category.id}
                      href={href}
                      className="homepage-footer-extension-tag"
                    >
                      {category.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="homepage-footer-existing-content">
            {footerInner}
          </div>
        </div>
      </footer>
    );
  }

  return <footer className="footer">{footerInner}</footer>;
}
