"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Target, Eye, GraduationCap, Building, BookOpen } from "lucide-react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import "@/styles/main.scss";
import "@/styles/pages/about.scss";

const TIMELINE_ITEMS = [
  {
    year: "2018",
    title: "Kuruluş ve İlk Adımlar",
    description:
      "Eğitimde fırsat eşitliği yaratma vizyonuyla yola çıktık ve platformumuzun temellerini attık.",
  },
  {
    year: "2020",
    title: "İlk 10.000 Öğrenci",
    description:
      "Platformumuz, ilk 10.000 öğrenciye ulaşarak önemli bir kilometre taşını geride bıraktı.",
  },
  {
    year: "2022",
    title: "Uluslararası Ortaklıklar",
    description:
      "Global eğitim kurumlarıyla ilk stratejik ortaklıklarımızı kurarak etki alanımızı genişlettik.",
  },
  {
    year: "2024",
    title: "Yenilikçi Teknolojiler",
    description:
      "Yapay zeka destekli rehberlik modülümüzü devreye alarak öğrenci deneyimini kişiselleştirdik.",
  },
];

const ABOUT_STATS = [
  {
    icon: "graduation-cap",
    value: 50000,
    suffix: "+",
    label: "Ulaşılan Öğrenci",
  },
  {
    icon: "building",
    value: 150,
    suffix: "+",
    label: "Partner Eğitim Kurumu",
  },
  {
    icon: "book-open",
    value: 1200,
    suffix: "+",
    label: "Tanıtılan Program",
  },
];

function formatNumberTurkish(num: number): string {
  return num.toLocaleString("tr-TR");
}

function AboutStatCard({
  stat,
}: {
  stat: { icon: string; value: number; suffix: string; label: string };
}) {
  const { ref, isVisible } = useInViewAnimation();
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    if (!isVisible) {
      setDisplayValue(0);
      return;
    }

    const duration = 1500;
    const startTime = Date.now();
    const startValue = 0;
    const endValue = stat.value;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (endValue - startValue) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, stat.value]);

  return (
    <div ref={ref} className="about-stat-card">
      <div className="about-stat-icon">
        {stat.icon === "graduation-cap" && <GraduationCap size={40} />}
        {stat.icon === "building" && <Building size={40} />}
        {stat.icon === "book-open" && <BookOpen size={40} />}
      </div>
      <div className="about-stat-value">
        {formatNumberTurkish(displayValue)}
        {stat.suffix}
      </div>
      <div className="about-stat-label">{stat.label}</div>
    </div>
  );
}

type AboutTimelineItemProps = {
  item: {
    year: string;
    title: string;
    description: string;
  };
  position: "left" | "right";
};

const AboutTimelineItem: React.FC<AboutTimelineItemProps> = ({ item, position }) => {
  const { ref, isVisible } = useInViewAnimation();

  return (
    <div
      ref={ref}
      className={[
        "about-timeline-item",
        `about-timeline-item--${position}`,
        isVisible ? "about-timeline-item--visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="about-timeline-card">
        <div className="about-timeline-card-header">
          <span className="about-timeline-year">{item.year}</span>
          <h3 className="about-timeline-title">{item.title}</h3>
        </div>
        <p className="about-timeline-description">{item.description}</p>
      </div>
    </div>
  );
};

export default function AboutPage() {
  return (
    <div className="page-container">
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
        </div>
      </header>

      <main className="about-page">
        <section className="about-hero">
          <div className="about-hero-card">
            <div className="about-hero-image-wrapper">
              <Image
                src="/images/aboutPage-banner.png"
                alt="MERKEZDEN Team"
                fill
                className="about-hero-image"
                priority
              />
            </div>
            <div className="about-hero-overlay" />
            <div className="about-hero-content">
              <h1 className="about-hero-title">Hakkımızda</h1>
              <p className="about-hero-subtitle">
                Eğitimin geleceğini şekillendirme ve her öğrenciye potansiyeline ulaşma
                fırsatı sunma yolculuğumuzu keşfedin.
              </p>
            </div>
          </div>
        </section>

        <section className="about-mission-vision">
          <div className="about-mission-vision-header">
            <h2 className="about-mission-vision-title">Misyonumuz ve Vizyonumuz</h2>
          </div>
          <div className="about-mission-vision-grid">
            <article className="about-card about-card-mission">
              <div className="about-card-header-row">
                <div className="about-card-icon">
                  <Target size={32} />
                </div>
                <h3 className="about-card-title">Misyonumuz</h3>
              </div>
              <div className="about-card-content">
                <p className="about-card-text">
                  Eğitim fırsatlarını herkes için erişilebilir kılmak ve öğrencilerin
                  potansiyellerini en üst düzeye çıkarmalarına yardımcı olmak.
                  Teknolojiyi kullanarak öğrenme süreçlerini kolaylaştırıyor ve
                  kişiselleştiriyoruz.
                </p>
              </div>
            </article>
            <article className="about-card about-card-vision">
              <div className="about-card-header-row">
                <div className="about-card-icon">
                  <Eye size={32} />
                </div>
                <h3 className="about-card-title">Vizyonumuz</h3>
              </div>
              <div className="about-card-content">
                <p className="about-card-text">
                  Türkiye'nin en kapsamlı ve güvenilir eğitim tanıtım platformu olarak,
                  öğrenim yolculuklarında herkese ilham vermek ve geleceğin liderlerini
                  yetiştirmeye katkıda bulunmak.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="about-timeline">
          <div className="about-timeline-header">
            <h2 className="about-timeline-title">Yolculuğumuzun Hikayesi</h2>
            <p className="about-timeline-subtitle">Kuruluşumuzdan bugüne önemli dönüm noktaları.</p>
          </div>
          <div className="about-timeline-body">
            {TIMELINE_ITEMS.map((item, index) => (
              <AboutTimelineItem
                key={item.year}
                item={item}
                position={index % 2 === 0 ? "left" : "right"}
              />
            ))}
          </div>
        </section>

        <section className="about-stats">
          <div className="about-stats-header">
            <h2 className="about-stats-title">Rakamlarla Başarımız</h2>
          </div>
          <div className="about-stats-grid">
            {ABOUT_STATS.map((stat, index) => (
              <AboutStatCard key={index} stat={stat} />
            ))}
          </div>
        </section>

        <section className="about-cta">
          <div className="about-cta-content">
            <h2 className="about-cta-title">Bu Yolculukta Bize Katılın</h2>
            <p className="about-cta-subtitle">
              Eğitimin geleceğini şekillendirme misyonumuzda yerinizi alın.
              <br />
              Platformumuzu keşfedin ve öğrenme devriminin bir parçası olun.
            </p>
            <Link href="/" className="about-cta-button">
              Platformu Keşfet
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

