import {
  Bot,
  ClipboardList,
  FileText,
  Grid2x2,
  ImagePlus,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import "@/styles/main.scss";
import "@/styles/pages/auth.scss";
import "@/styles/pages/uyelik.scss";

type FeatureItem = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const LEFT_FEATURES: FeatureItem[] = [
  {
    title: "Haritada Ara",
    description: "Konumunuza uygun kurumları harita üzerinden bulun.",
    icon: MapPinned,
  },
  {
    title: "Kritere Gore Listeleme",
    description: "Kriterlerinize gore hizli ve detayli filtreleme yapin.",
    icon: ClipboardList,
  },
  {
    title: "Akilli Asistan",
    description: "AI destekli oneriler ile dogru kurumlari kesfedin.",
    icon: Sparkles,
  },
  {
    title: "Karsilastirma Tablosu",
    description: "Kurumlari yan yana karsilastirin.",
    icon: Grid2x2,
  },
];

const RIGHT_FEATURES: FeatureItem[] = [
  {
    title: "Detayli Kurum Sayfasi",
    description: "Kurumunuzu detayli tanitin.",
    icon: FileText,
  },
  {
    title: "Fotograf / Video Ekleme",
    description: "Kurumunuza ait fotograf ve videolar ekleyin.",
    icon: ImagePlus,
  },
  {
    title: "SEO Avantajlari",
    description: "Merkezden.com sayesinde Google gorunurlugunuzu artirin.",
    icon: Search,
  },
  {
    title: "Duyuru / Etkinlik Paylasma",
    description: "Duyuru ve etkinliklerinizi yayinlayin.",
    icon: Megaphone,
  },
];

function FeatureCard({
  item,
  accent,
}: {
  item: FeatureItem;
  accent: "purple" | "orange";
}) {
  const Icon = item.icon;
  return (
    <article className={`uyelik-feature-card uyelik-feature-card--${accent}`}>
      <span className="uyelik-feature-icon-wrap" aria-hidden>
        <Icon className="uyelik-feature-icon" />
      </span>
      <h3 className="uyelik-feature-title">{item.title}</h3>
      <p className="uyelik-feature-description">{item.description}</p>
    </article>
  );
}

function IndividualFormCard() {
  return (
    <article className="signup-card uyelik-form-card uyelik-form-card--individual">
      <div className="uyelik-form-card-title-row">
        <span className="uyelik-form-card-badge uyelik-form-card-badge--purple" aria-hidden>
          <Bot className="uyelik-form-card-badge-icon" />
        </span>
        <h2 className="signup-title uyelik-form-title">Bireysel Kayit</h2>
      </div>

      <form className="signup-form" action="#">
        <div className="signup-field">
          <label htmlFor="uyelik-individual-first-name" className="signup-label">
            Ad
          </label>
          <input
            id="uyelik-individual-first-name"
            type="text"
            className="signup-input"
            placeholder="Adinizi girin"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-individual-last-name" className="signup-label">
            Soyad
          </label>
          <input
            id="uyelik-individual-last-name"
            type="text"
            className="signup-input"
            placeholder="Soyadinizi girin"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-individual-email" className="signup-label">
            E-posta Adresi
          </label>
          <input
            id="uyelik-individual-email"
            type="email"
            className="signup-input"
            placeholder="eposta@adresiniz.com"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-individual-birth-date" className="signup-label">
            Dogum Tarihi
          </label>
          <input id="uyelik-individual-birth-date" type="date" className="signup-input" readOnly />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-individual-password" className="signup-label">
            Sifre
          </label>
          <input
            id="uyelik-individual-password"
            type="password"
            className="signup-input"
            placeholder="En az 8 karakter"
            readOnly
          />
        </div>

        <label className="signup-checkbox">
          <input type="checkbox" />
          <span>
            Kayit olarak{" "}
            <span className="signup-link-inline">Kullanim Kosullarimizi</span> ve{" "}
            <span className="signup-link-inline">Gizlilik Politikamizi</span> kabul etmis olursunuz.
          </span>
        </label>

        <button type="button" className="signup-primary-button">
          Hesap Olustur
        </button>
      </form>
    </article>
  );
}

function CorporateFormCard() {
  return (
    <article className="signup-card uyelik-form-card uyelik-form-card--corporate">
      <div className="uyelik-form-card-title-row">
        <span className="uyelik-form-card-badge uyelik-form-card-badge--orange" aria-hidden>
          <FileText className="uyelik-form-card-badge-icon" />
        </span>
        <h2 className="signup-title uyelik-form-title">Kurumsal Kayit</h2>
      </div>

      <div className="uyelik-corporate-tabs" role="tablist" aria-label="Kurumsal uye tipi">
        <button type="button" className="uyelik-corporate-tab uyelik-corporate-tab--active">
          Kurum
        </button>
        <button type="button" className="uyelik-corporate-tab">
          Bireysel Egitmen
        </button>
      </div>

      <form className="signup-form" action="#">
        <div className="signup-field">
          <label htmlFor="uyelik-corporate-name" className="signup-label">
            Kurum Adiniz
          </label>
          <input
            id="uyelik-corporate-name"
            type="text"
            className="signup-input"
            placeholder="Kurum adini girin"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-corporate-email" className="signup-label">
            E-posta Adresi
          </label>
          <input
            id="uyelik-corporate-email"
            type="email"
            className="signup-input"
            placeholder="kurum@adresiniz.com"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-corporate-password" className="signup-label">
            Sifre
          </label>
          <input
            id="uyelik-corporate-password"
            type="password"
            className="signup-input"
            placeholder="En az 8 karakter"
            readOnly
          />
        </div>

        <div className="signup-field">
          <label htmlFor="uyelik-corporate-reference" className="signup-label">
            Referansiniz
          </label>
          <input
            id="uyelik-corporate-reference"
            type="text"
            className="signup-input"
            placeholder="Referans kisiyi veya kurumu yazin"
            readOnly
          />
        </div>

        <label className="signup-checkbox">
          <input type="checkbox" />
          <span>
            Kayit olarak{" "}
            <span className="signup-link-inline">Kullanim Kosullarimizi</span> ve{" "}
            <span className="signup-link-inline">Gizlilik Politikamizi</span> kabul etmis olursunuz.
          </span>
        </label>

        <button type="button" className="signup-primary-button uyelik-corporate-cta">
          Hesap Olustur
        </button>
      </form>
    </article>
  );
}

export default function UyelikPage() {
  return (
    <main className="uyelik-page">
      <div className="uyelik-layout">
        <aside className="uyelik-feature-column uyelik-feature-column--left">
          {LEFT_FEATURES.map((item) => (
            <FeatureCard key={item.title} item={item} accent="purple" />
          ))}
        </aside>

        <section className="uyelik-form-column">
          <IndividualFormCard />
        </section>

        <section className="uyelik-form-column">
          <CorporateFormCard />
        </section>

        <aside className="uyelik-feature-column uyelik-feature-column--right">
          {RIGHT_FEATURES.map((item) => (
            <FeatureCard key={item.title} item={item} accent="orange" />
          ))}
        </aside>
      </div>
    </main>
  );
}
