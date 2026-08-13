import type { Metadata } from "next";
import {
  CheckCircle2,
  Eye,
  Landmark,
  Search,
  TrendingUp,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import {
  CORPORATE_SIGNUP_FEATURES,
  INDIVIDUAL_SIGNUP_FEATURES,
  INSTRUCTOR_SIGNUP_FEATURES,
  type SignupFeatureItem,
} from "@/lib/signupFeatureCards";
import "@/styles/pages/nasil-calisir.scss";

export const metadata: Metadata = {
  title: "Nasıl Çalışır? | Merkezden",
  description:
    "Merkezden.com platformunda bireysel kullanıcılar, kurumlar ve eğitmenler için temel akışı 30 saniyede keşfedin.",
};

type FeatureCardItem = SignupFeatureItem;

function FeatureItemCard({
  item,
  accent,
}: {
  item: FeatureCardItem;
  accent: "purple" | "orange" | "navy";
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
          <h1 className="nasil-calisir-hero-title">
            <img
              src="/images/merkezden-logo.svg"
              alt="Merkezden.com"
              className="nasil-calisir-hero-logo"
            />
            <span>Nasıl Çalışır?</span>
          </h1>
          <p className="nasil-calisir-hero-subtitle">Platformu 30 Saniyede Keşfedin</p>
        </section>

        <section className="nasil-calisir-row" aria-label="Bireysel kullanıcılar için temel kullanım akışı">
          <article className="nasil-calisir-big-card nasil-calisir-visual">
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

            <Link href="/giris" className="nasil-calisir-big-card-cta">
              Hemen Keşfedin
            </Link>
          </article>

          <section className="nasil-calisir-section nasil-calisir-features">
            <div className="nasil-calisir-feature-grid">
              {INDIVIDUAL_SIGNUP_FEATURES.map((item) => (
                <FeatureItemCard key={item.title} item={item} accent="navy" />
              ))}
            </div>
          </section>
        </section>

        <section className="nasil-calisir-row" aria-label="Kurumlar için temel kullanım akışı">
          <article className="nasil-calisir-big-card nasil-calisir-visual">
            <h2 className="nasil-calisir-big-card-title">Kurumlar İçin</h2>
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

            <Link href="/kayit-ol" className="nasil-calisir-big-card-cta">
              Ücretsiz Kayıt Olun
            </Link>
          </article>

          <section className="nasil-calisir-section nasil-calisir-features">
            <div className="nasil-calisir-feature-grid">
              {CORPORATE_SIGNUP_FEATURES.map((item) => (
                <FeatureItemCard key={item.title} item={item} accent="orange" />
              ))}
            </div>
          </section>
        </section>

        <section className="nasil-calisir-row" aria-label="Özel ders ve eğitmenler için temel kullanım akışı">
          <article className="nasil-calisir-big-card nasil-calisir-big-card--navy nasil-calisir-visual">
            <h2 className="nasil-calisir-big-card-title">Özel Ders / Eğitmenler İçin</h2>
            <ul className="nasil-calisir-big-card-list">
              <li>
                <UserRound className="nasil-calisir-big-card-list-icon" />
                <span>Branşlarınızı ve eğitim bilgilerinizi tanıtın.</span>
              </li>
              <li>
                <Search className="nasil-calisir-big-card-list-icon" />
                <span>Merkezden.com SEO avantajlarından yararlanın.</span>
              </li>
              <li>
                <TrendingUp className="nasil-calisir-big-card-list-icon" />
                <span>Ders taleplerinizi arttırın.</span>
              </li>
            </ul>

            <div className="nasil-calisir-big-card-media">
              <img
                src="/images/ozel-ders.png"
                alt="Özel ders ve eğitmenler için nasıl çalışır görseli"
                className="nasil-calisir-big-card-media-image"
              />
            </div>

            <Link href="/kayit-ol" className="nasil-calisir-big-card-cta">
              Ücretsiz Kayıt Olun
            </Link>
          </article>

          <section className="nasil-calisir-section nasil-calisir-features">
            <div className="nasil-calisir-feature-grid">
              {INSTRUCTOR_SIGNUP_FEATURES.map((item) => (
                <FeatureItemCard key={item.title} item={item} accent="purple" />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
