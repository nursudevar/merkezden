"use client";

import { CalendarDays, MapPin } from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";
import "@/styles/pages/announcements.scss";

export default function AnnouncementsPage() {
  return (
    <div className="page-container">
      <HeaderClientWrapper />

      <main className="main-content">
        <div className="announcements-page">
          <section className="blog-listing-header">
            <h1 className="blog-listing-title">Duyurular</h1>
            <p className="blog-listing-subtitle">
              Platformdaki en yeni gelişmeleri, kampanyaları ve bilgilendirmeleri buradan takip edin.
            </p>
          </section>

          <section className="announcements-section" aria-label="Duyuru listesi">
            <div className="announcements-grid">
              <article className="announcement-featured">
                <div
                  className="announcement-featured-media"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=700&fit=crop")',
                  }}
                >
                  <span className="announcement-badge">Yeni</span>
                  <div className="announcement-featured-overlay" />
                  <div className="announcement-featured-body">
                    <h2 className="announcement-featured-title">Eğitimde Bahar Dönemi Kayıtları Başladı</h2>
                    <p className="announcement-featured-desc">
                      Yakınınızdaki kurumları karşılaştırın, fiyat ve hizmet detaylarını tek ekranda inceleyin.
                    </p>
                    <div className="announcement-featured-meta">
                      <span className="announcement-meta-item">
                        <CalendarDays className="announcement-meta-icon" />
                        2 Mart 2026
                      </span>
                      <span className="announcement-meta-item">
                        <MapPin className="announcement-meta-icon" />
                        Ankara
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              <div className="announcements-side">
                <article className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">KAMPANYA</div>
                    <h3 className="announcement-small-title">Üyeliğe Özel İlk Görüşme İndirimi</h3>
                    <p className="announcement-small-desc">
                      Seçili kurumlarda tanışma dersleri ve değerlendirme görüşmeleri avantajlı.
                    </p>
                  </div>
                </article>

                <article className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1454165205744-3b78555e5572?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">BİLGİLENDİRME</div>
                    <h3 className="announcement-small-title">Yeni Filtreler ve Arama Deneyimi</h3>
                    <p className="announcement-small-desc">
                      Lokasyon, fiyat ve kategori filtreleriyle en uygun seçeneklere daha hızlı ulaşın.
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
