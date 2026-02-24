"use client";

import { useState } from "react";
import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin, ChevronDown } from "lucide-react";

export default function Footer() {
  const [openKurumsal, setOpenKurumsal] = useState(false);
  const [openDestek, setOpenDestek] = useState(false);
  const [openKategoriler, setOpenKategoriler] = useState(false);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="footer-brand-title-link">
              <span className="footer-brand-title">
                MERKEZDEN<span className="footer-brand-title-accent">.COM</span>
              </span>
            </Link>
            <p className="footer-brand-subtitle">
              Hayatın merkezi, hizmetin adresi. Eğitimden sanata, spordan kariyere uzanan geniş yelpazede aradığınız her şey tek bir platformda.
            </p>
            <div className="footer-social">
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

          <div className={`footer-section footer-section-accordion ${openKategoriler ? "is-open" : ""}`}>
            <button
              type="button"
              className="footer-section-header"
              aria-expanded={openKategoriler}
              aria-controls="footer-kategoriler"
              id="footer-kategoriler-btn"
              onClick={() => setOpenKategoriler(!openKategoriler)}
            >
              <span className="footer-section-title">Kategoriler</span>
              <ChevronDown className="footer-section-chevron" aria-hidden size={20} />
            </button>
            <div
              id="footer-kategoriler"
              role="region"
              aria-labelledby="footer-kategoriler-btn"
              className="footer-section-content"
            >
              <ul className="footer-section-list">
                <li className="footer-section-item">
                  <Link href="/school">Okul</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="/courses">Kurs</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="/sports">Spor</Link>
                </li>
                <li className="footer-section-item">
                  <Link href="/arts">Sanat</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-divider" />
        <div className="footer-bottom">
          <div className="footer-copyright-row">
            <span className="footer-copyright">© 2024 MERKEZDEN.COM</span>
            <span className="footer-copyright footer-copyright-right">Tüm Hakları Saklıdır.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
