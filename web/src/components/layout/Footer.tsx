import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

export default function Footer() {
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
          <div className="footer-section">
            <h3 className="footer-section-title">Kurumsal</h3>
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
          <div className="footer-section">
            <h3 className="footer-section-title">Destek</h3>
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
          <div className="footer-section">
            <h3 className="footer-section-title">Kategoriler</h3>
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
