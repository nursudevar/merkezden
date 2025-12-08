import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="footer-brand-title-link">
              <div className="footer-brand-title">MERKEZDEN.COM</div>
            </Link>
            <p className="footer-brand-subtitle">Hayatın merkezi, hizmetin adresi</p>
          </div>
          <div className="footer-section">
            <div className="footer-section-title">Kurumsal</div>
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
            <div className="footer-section-title">Destek</div>
            <ul className="footer-section-list">
              <li className="footer-section-item">Yardım Merkezi</li>
              <li className="footer-section-item">Kullanım Şartları</li>
              <li className="footer-section-item">Gizlilik Politikası</li>
            </ul>
          </div>
          <div className="footer-section">
            <div className="footer-section-title">Kategoriler</div>
            <ul className="footer-section-list">
              <li className="footer-section-item">Okul</li>
              <li className="footer-section-item">Kurs</li>
              <li className="footer-section-item">Spor</li>
              <li className="footer-section-item">Sanat</li>
            </ul>
          </div>
        </div>
        <div className="footer-divider" />
        <div className="footer-copyright">
          © 2024 MERKEZDEN.COM - Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}

