"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { GitCompare, Heart, SlidersHorizontal, UserRound } from "lucide-react";

type HomeFilterTip = {
  kind: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const HOME_FILTER_TIPS: HomeFilterTip[] = [
  {
    kind: "İPUCU",
    title: "Profilini güncel tut",
    description:
      "Profilindeki bilgiler ve görseller ne kadar güncel ve eksiksiz olursa, diğer kullanıcıların seni veya kurumunu tanıması o kadar kolay olur. Bilgilerini düzenli olarak kontrol etmeyi unutma.",
    icon: UserRound,
  },
  {
    kind: "FİKİR",
    title: "Favorilerini kaydet",
    description:
      "İlgini çeken kurumları ve eğitmenleri favorilerine ekleyerek daha sonra tekrar aramak zorunda kalmadan kolayca ulaşabilirsin. Böylece seçeneklerini tek bir yerde toplayabilirsin.",
    icon: Heart,
  },
  {
    kind: "KEŞFET",
    title: "Seçeneklerini karşılaştır",
    description:
      "Beğendiğin kurumları karşılaştırma listesine ekleyerek eğitim imkanlarını, özelliklerini ve diğer önemli bilgileri yan yana inceleyebilirsin. Karar verirken seçeneklerini daha rahat değerlendirebilirsin.",
    icon: GitCompare,
  },
  {
    kind: "İPUCU",
    title: "Aradığını daha hızlı bul",
    description:
      "Konum, kategori ve diğer detaylı filtreleri kullanarak yüzlerce sonuç arasından sana en uygun seçeneklere çok daha hızlı ulaşabilirsin. Filtreleri daralttıkça sonuçların daha isabetli hale gelir.",
    icon: SlidersHorizontal,
  },
];

const TIP_ROTATE_MS = 2000;
const FEATURED_GRID_ID = "home-featured-grid";
const DESKTOP_ALIGN_MQ = "(min-width: 1024px)";

export function HomeFilterTipsBox() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tipsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % HOME_FILTER_TIPS.length);
    }, TIP_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const tipsEl = tipsRef.current;
    if (!tipsEl) return;

    const syncHeight = () => {
      const featuredGrid = document.getElementById(FEATURED_GRID_ID);
      const isDesktop = window.matchMedia(DESKTOP_ALIGN_MQ).matches;

      if (!featuredGrid || !isDesktop) {
        tipsEl.style.minHeight = "";
        return;
      }

      const featuredBottom = featuredGrid.getBoundingClientRect().bottom;
      const tipsTop = tipsEl.getBoundingClientRect().top;
      const nextHeight = Math.round(featuredBottom - tipsTop);

      if (nextHeight >= 140) {
        tipsEl.style.minHeight = `${nextHeight}px`;
      } else {
        tipsEl.style.minHeight = "";
      }
    };

    const resizeObserver = new ResizeObserver(syncHeight);
    const featuredGrid = document.getElementById(FEATURED_GRID_ID);
    const filterCard = document
      .getElementById("home-filter-sidebar")
      ?.querySelector(".filter-sidebar-card");

    if (featuredGrid) resizeObserver.observe(featuredGrid);
    if (filterCard) resizeObserver.observe(filterCard);

    window.addEventListener("resize", syncHeight);
    syncHeight();

    const delayedSync = window.setTimeout(syncHeight, 800);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncHeight);
      window.clearTimeout(delayedSync);
      tipsEl.style.minHeight = "";
    };
  }, []);

  const activeTip = HOME_FILTER_TIPS[activeIndex];
  const ActiveIcon = activeTip.icon;

  return (
    <section
      ref={tipsRef}
      className="home-filter-tips"
      aria-label="İpuçları ve fikirler"
      aria-live="polite"
    >
      <div className="home-filter-tips-card">
        <div className="home-filter-tips-body-wrap">
          <div key={activeIndex} className="home-filter-tips-body">
            <div className="home-filter-tips-icon-wrap" aria-hidden>
              <ActiveIcon className="home-filter-tips-icon" size={26} />
            </div>
            <span className="home-filter-tips-kind">{activeTip.kind}</span>
            <h3 className="home-filter-tips-title">{activeTip.title}</h3>
            <p className="home-filter-tips-description">{activeTip.description}</p>
          </div>
        </div>
        <div className="home-filter-tips-dots" role="tablist" aria-label="İpucu göstergeleri">
          {HOME_FILTER_TIPS.map((tip, index) => (
            <button
              key={`${tip.kind}-${tip.title}`}
              type="button"
              role="tab"
              className={`home-filter-tips-dot${
                index === activeIndex ? " home-filter-tips-dot--active" : ""
              }`}
              aria-label={`${tip.title} ipucu`}
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
