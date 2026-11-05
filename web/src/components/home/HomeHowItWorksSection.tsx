"use client";

import type { CSSProperties } from "react";

type HowItWorksStep = {
  id: string;
  label: string;
  /** Stage penceresine göre yüzde (ikon merkezi) */
  x: number;
  y: number;
  icon: "grid" | "filter" | "pin" | "compare" | "compass";
};

/**
 * Konumlar sıkılaştırılmış PNG penceresine (y≈282–493) göre.
 * x aynı; y, rota hizasını korumak için orantılı yeniden ölçeklendi.
 */
const HOW_IT_WORKS_STEPS: readonly HowItWorksStep[] = [
  { id: "category", label: "Kategori Seçin", x: 15.5, y: 30.0, icon: "grid" },
  { id: "filter", label: "Detaylı Filtreleyin", x: 32.0, y: 46.9, icon: "filter" },
  { id: "map", label: "Haritada Arayın", x: 50.0, y: 58.2, icon: "pin" },
  { id: "compare", label: "Karşılaştırın", x: 68.5, y: 44.1, icon: "compare" },
  { id: "find", label: "Uygun Eğitimi Bulun", x: 85.5, y: 32.8, icon: "compass" },
] as const;

function StepGlyph({ type }: { type: HowItWorksStep["icon"] }) {
  const common = {
    width: 27,
    height: 27,
    viewBox: "0 0 34 34",
    fill: "none",
    "aria-hidden": true as const,
    focusable: false as const,
  };

  switch (type) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="10" height="10" rx="2.5" fill="currentColor" />
          <rect x="19" y="5" width="10" height="10" rx="2.5" fill="currentColor" />
          <rect x="5" y="19" width="10" height="10" rx="2.5" fill="currentColor" />
          <rect x="19" y="19" width="10" height="10" rx="2.5" fill="currentColor" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M6.5 7.5h21a1.5 1.5 0 0 1 1.1 2.5L19.5 19v7.2a1.5 1.5 0 0 1-2.3 1.3l-3.2-1.9a1.5 1.5 0 0 1-.7-1.3V19L5.4 10A1.5 1.5 0 0 1 6.5 7.5Z"
          />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M17 3.5c-5.1 0-9.2 4-9.2 9 0 6.6 8.1 16.2 8.5 16.6a1 1 0 0 0 1.4 0c.4-.4 8.5-10 8.5-16.6 0-5-4.1-9-9.2-9Zm0 12.4a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      );
    case "compare":
      return (
        <svg {...common}>
          <rect
            x="5.5"
            y="8.5"
            width="14"
            height="14"
            rx="3"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="none"
          />
          <rect
            x="14.5"
            y="11.5"
            width="14"
            height="14"
            rx="3"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="rgba(255,255,255,0.92)"
          />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="17" cy="17" r="12" fill="currentColor" opacity="0.18" />
          <circle cx="17" cy="17" r="12" stroke="currentColor" strokeWidth="2.2" fill="none" />
          <path fill="currentColor" d="M17 8.2 21.8 17 17 25.8 12.2 17Z" />
          <circle cx="17" cy="17" r="2.2" fill="#fff" />
        </svg>
      );
    default:
      return null;
  }
}

export function HomeHowItWorksSection() {
  return (
    <section className="home-how-it-works" aria-label="Nasıl çalışır">
      <div className="home-how-it-works-stage">
        {/* eslint-disable-next-line @next/next/no-img-element -- static full-bleed artwork */}
        <img
          className="home-how-it-works-bg"
          src="/images/homepage-nasil-calisir.png"
          alt=""
          width={2172}
          height={724}
          aria-hidden="true"
          draggable={false}
        />

        <ol className="home-how-it-works-steps">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li
              key={step.id}
              className={`home-how-it-works-step home-how-it-works-step--${step.id}`}
              style={
                {
                  "--hiw-x": `${step.x}%`,
                  "--hiw-y": `${step.y}%`,
                } as CSSProperties
              }
            >
              <span className="home-how-it-works-step-icon" aria-hidden="true">
                <StepGlyph type={step.icon} />
              </span>
              <span className="home-how-it-works-step-label">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
