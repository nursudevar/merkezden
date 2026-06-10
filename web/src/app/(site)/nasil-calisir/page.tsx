import type { Metadata } from "next";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  ImagePlus,
  Landmark,
  ListFilter,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
  Star,
  Table2,
  Tags,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import "@/styles/pages/nasil-calisir.scss";

export const metadata: Metadata = {
  title: "Nasıl Çalışır? | Merkezden",
  description:
    "Merkezden.com platformunda bireysel kullanıcılar ve kurumlar için temel akışı 30 saniyede keşfedin.",
};

type FeatureCardItem = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const INDIVIDUAL_FEATURES: FeatureCardItem[] = [
  {
    title: "Haritada Arama",
    description: "Konumunuza yakın kurumları harita üzerinde bulun",
    icon: MapPinned,
  },
  {
    title: "Filtreli Listeleme",
    description: "Kriterlerinize uygun kurumlara hızlıca ulaşın.",
    icon: ListFilter,
  },
  {
    title: "Akıllı Asistan",
    description: "AI destekli önerileri alın",
    icon: Sparkles,
  },
  {
    title: "Karşılaştırma Tablosu",
    description: "Kurumları karşılaştırın, size en uygun seçimi yapın.",
    icon: Table2,
  },
  {
    title: "Detaylı İnceleme",
    description: "Kapsamlı bilgileri inceleyip değerlendirin",
    icon: Search,
  },
  {
    title: "Size Özel Avantajlar",
    description: "İndirim ve kampanyalardan yararlanın.",
    icon: Tags,
  },
];

const INSTITUTION_FEATURES: FeatureCardItem[] = [
  {
    title: "Detaylı Profil Sayfası",
    description: "Kurumunuzu detaylı tanıtın",
    icon: UserPlus,
  },
  {
    title: "Fotoğraf/Video Ekleme",
    description: "Kurumunuza ait fotoğraf ve videoları ekleyin",
    icon: ImagePlus,
  },
  {
    title: "Duyuru/Etkinlik Paylaşma",
    description: "Duyuru ve Etkinliklerinizi Yayınlayın",
    icon: Megaphone,
  },
  {
    title: "SEO Avantajları",
    description: "Merkezden.com sayesinde Google'da Görünürlüğünüzü Artırın",
    icon: Search,
  },
  {
    title: "Potansiyel Öğrenci Analizi",
    description: "Ziyaretçi verilerinizi analiz edin, stratejinizi güçlendirin.",
    icon: BarChart3,
  },
  {
    title: "Öne Çıkanlar Sayfası",
    description: "Daha fazla öğrenciye ulaşın.",
    icon: Star,
  },
];

function FeatureItemCard({
  item,
  accent,
}: {
  item: FeatureCardItem;
  accent: "purple" | "orange";
}) {
  const Icon = item.icon;

  return (
    <article className={`nasil-calisir-feature-card nasil-calisir-feature-card--${accent}`}>
      <Icon className="nasil-calisir-feature-card-icon" />
      <h3 className="nasil-calisir-feature-card-title">{item.title}</h3>
      <p className="nasil-calisir-feature-card-description">{item.description}</p>
    </article>
  );
}

export default function NasilCalisirPage() {
  return (
    <main className="nasil-calisir-page">
      <div className="nasil-calisir-page-container">
        <section className="nasil-calisir-hero">
          <h1 className="nasil-calisir-hero-title">Merkezden.com Nasıl Çalışır?</h1>
          <p className="nasil-calisir-hero-subtitle">Platformu 30 Saniyede Keşfedin</p>
        </section>

        <section className="nasil-calisir-cards" aria-label="Temel kullanım akışı">
          <article className="nasil-calisir-big-card">
            <h2 className="nasil-calisir-big-card-title">Bireysel Kullanıcılar İçin</h2>
            <ul className="nasil-calisir-big-card-list">
              <li>
                <Search className="nasil-calisir-big-card-list-icon" />
                <span>Kurumları Keşfedin</span>
              </li>
              <li>
                <Landmark className="nasil-calisir-big-card-list-icon" />
                <span>Karşılaştırın</span>
              </li>
              <li>
                <CheckCircle2 className="nasil-calisir-big-card-list-icon" />
                <span>En Doğru Seçimi Yapın</span>
              </li>
            </ul>

            <div className="nasil-calisir-big-card-media">
              <img
                src="/images/bireysel_nasilcalisir.png"
                alt="Bireysel kullanıcılar için nasıl çalışır görseli"
                className="nasil-calisir-big-card-media-image"
              />
            </div>

            <Link href="/login" className="nasil-calisir-big-card-cta">
              Hemen Keşfedin
            </Link>
          </article>

          <article className="nasil-calisir-big-card">
            <h2 className="nasil-calisir-big-card-title">Kurumlar / Eğitmenler İçin</h2>
            <ul className="nasil-calisir-big-card-list">
              <li>
                <UserPlus className="nasil-calisir-big-card-list-icon" />
                <span>Profil Oluşturun</span>
              </li>
              <li>
                <Eye className="nasil-calisir-big-card-list-icon" />
                <span>Görünürlüğünüzü Artırın</span>
              </li>
              <li>
                <TrendingUp className="nasil-calisir-big-card-list-icon" />
                <span>Daha Fazla Öğrenciye Ulaşın</span>
              </li>
            </ul>

            <div className="nasil-calisir-big-card-media">
              <img
                src="/images/kurumsal_nasilcalisir.png"
                alt="Kurumsal kullanıcılar için nasıl çalışır görseli"
                className="nasil-calisir-big-card-media-image"
              />
            </div>

            <Link href="/signup" className="nasil-calisir-big-card-cta">
              Ücretsiz Kayıt Olun
            </Link>
          </article>
        </section>

        <section className="nasil-calisir-section">
          <h2 className="nasil-calisir-section-title">Bireysel Kullanıcılar İçin Özellikler</h2>
          <div className="nasil-calisir-feature-grid">
            {INDIVIDUAL_FEATURES.map((item) => (
              <FeatureItemCard key={item.title} item={item} accent="purple" />
            ))}
          </div>
        </section>

        <section className="nasil-calisir-section">
          <h2 className="nasil-calisir-section-title">Kurumlar / Eğitmenler İçin Özellikler</h2>
          <div className="nasil-calisir-feature-grid">
            {INSTITUTION_FEATURES.map((item) => (
              <FeatureItemCard key={item.title} item={item} accent="orange" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
