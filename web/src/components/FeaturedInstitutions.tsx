"use client";

import { useState } from 'react';
import Link from 'next/link';

type FeaturedInstitution = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  imageUrl: string;
  badge: {
    icon: string;
    label: string;
    color: string;
  };
};

const featuredInstitutions: FeaturedInstitution[] = [
  {
    id: 1,
    name: "Boğaziçi Koleji",
    location: "İSTANBUL, BEŞİKTAŞ",
    description: "Global vizyonu ve modern eğitim kampüsü ile geleceğin liderlerini yetiştiren prestijli bir kurum.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
    badge: {
      icon: "✓",
      label: "%25 Burs",
      color: "purple"
    }
  },
  {
    id: 2,
    name: "Ankara Bilim Lisesi",
    location: "ANKARA, ÇANKAYA",
    description: "Teknoloji ve bilim odaklı müfredatıyla fark yaratan bir eğitim kurumu.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    badge: {
      icon: "🎓",
      label: "Fen Lisesi",
      color: "blue"
    }
  },
  {
    id: 3,
    name: "Ege Çağdaş Koleji",
    location: "İZMİR, KONAK",
    description: "Sanat ve spor aktiviteleriyle zenginleştirilmiş, bütünsel gelişim odaklı eğitim anlayışı.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop",
    badge: {
      icon: "🌿",
      label: "Yeşil Kampüs",
      color: "green"
    }
  },
  {
    id: 4,
    name: "Nilüfer Akademi",
    location: "BURSA, NİLÜFER",
    description: "Uluslararası standartlarda yabancı dil eğitimi ve yurt dışı eğitim fırsatları sunan kurum.",
    rating: 5.0,
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
    badge: {
      icon: "🌍",
      label: "Çift Dil",
      color: "purple"
    }
  },
  {
    id: 5,
    name: "İstanbul Teknik Koleji",
    location: "İSTANBUL, KADIKÖY",
    description: "Mühendislik ve teknoloji alanında uzmanlaşmış, çağdaş eğitim yaklaşımıyla öne çıkan kurum.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    badge: {
      icon: "🔧",
      label: "Teknik",
      color: "blue"
    }
  },
  {
    id: 6,
    name: "Ankara Yabancı Dil Koleji",
    location: "ANKARA, ÇANKAYA",
    description: "Çok dilli eğitim programı ve uluslararası değişim fırsatlarıyla öğrencilerine global vizyon kazandıran kurum.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop",
    badge: {
      icon: "🗣️",
      label: "Çok Dilli",
      color: "blue"
    }
  },
  {
    id: 7,
    name: "İzmir Sanat Akademisi",
    location: "İZMİR, KONAK",
    description: "Müzik, resim ve tiyatro alanlarında yetenekli öğrencileri keşfeden ve geliştiren sanat odaklı kurum.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=400&fit=crop",
    badge: {
      icon: "🎨",
      label: "Sanat",
      color: "purple"
    }
  },
  {
    id: 8,
    name: "Ankara Spor Lisesi",
    location: "ANKARA, ÇANKAYA",
    description: "Profesyonel sporcu yetiştirme programı ve modern spor tesisleriyle öne çıkan kurum.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop",
    badge: {
      icon: "⚽",
      label: "Spor",
      color: "green"
    }
  }
];

export default function FeaturedInstitutions() {
  // Shuffle featured institutions on component mount (client-only)
  const [shuffledFeaturedInstitutions] = useState(() => {
    const shuffled = [...featuredInstitutions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  return (
    <section className="featured-institutions-section">
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title">Öne Çıkanlar</h2>
          <p className="featured-institutions-subtitle">Eğitim hayatınızı şekillendirecek en prestijli kurumları keşfedin.</p>
        </div>
      </div>
      <div className="featured-institutions-slider">
        <div className="featured-institutions-scroller">
          {shuffledFeaturedInstitutions.map((institution) => (
            <div key={institution.id} className="featured-institution-card">
              <div className="featured-institution-image-wrapper">
                <img 
                  src={institution.imageUrl} 
                  alt={institution.name}
                  className="featured-institution-image"
                />
                <div className="featured-institution-overlay" />
                <div className={`featured-institution-badge featured-institution-badge--${institution.badge.color}`}>
                  <span className="featured-institution-badge-icon">{institution.badge.icon}</span>
                  <span className="featured-institution-badge-label">{institution.badge.label}</span>
                </div>
                <button 
                  type="button" 
                  className="featured-institution-favorite"
                  aria-label="Favorilere ekle"
                >
                  <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 17.35L8.55 16.03C3.4 11.36 0 8.28 0 4.5C0 1.96 2.24 0 5 0C6.74 0 8.41 0.81 9.5 2.09C10.59 0.81 12.26 0 14 0C16.76 0 19 1.96 19 4.5C19 8.28 15.6 11.36 10.45 16.04L10 17.35Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
              <div className="featured-institution-content">
                <div className="featured-institution-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{institution.location}</span>
                </div>
                <h3 className="featured-institution-name">{institution.name}</h3>
                <p className="featured-institution-description">{institution.description}</p>
                <div className="featured-institution-footer">
                  <div className="featured-institution-rating">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 0L9.79611 5.52786L15.6085 5.52786L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786L6.20389 5.52786L8 0Z" fill="currentColor"/>
                    </svg>
                    <span>{institution.rating}</span>
                  </div>
                  <Link href="#" className="featured-institution-link">
                    İncele ›
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="featured-institutions-view-all">
        <Link href="#">
          Tüm Kurumları Görüntüle →
        </Link>
      </div>
    </section>
  );
}

