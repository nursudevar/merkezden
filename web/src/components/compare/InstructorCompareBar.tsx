"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useInstructorCompare } from "./InstructorCompareProvider";

export function InstructorCompareBar() {
  const pathname = usePathname();
  const { items, remove } = useInstructorCompare();

  if (pathname === "/karsilastir/egitmenler") return null;
  if (items.length === 0) return null;

  const canCompare = items.length >= 2;
  const href = `/karsilastir/egitmenler?ids=${items.map((item) => item.id).join(",")}`;

  return (
    <div
      className="institution-compare-bar instructor-compare-bar"
      role="region"
      aria-label="Eğitmen karşılaştırma"
    >
      <div className="institution-compare-bar-inner">
        <div className="institution-compare-bar-copy">
          <p className="institution-compare-bar-title">Eğitmen Karşılaştırma</p>
          <p className="institution-compare-bar-count">{items.length} / 3 eğitmen</p>
        </div>

        <ul className="institution-compare-bar-list">
          {items.map((item) => (
            <li key={item.id} className="institution-compare-bar-item">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="institution-compare-bar-logo"
                />
              ) : (
                <span className="institution-compare-bar-logo institution-compare-bar-logo--fallback" aria-hidden>
                  {item.name.trim().charAt(0).toUpperCase() || "E"}
                </span>
              )}
              <span className="institution-compare-bar-name">{item.name}</span>
              <button
                type="button"
                className="institution-compare-bar-remove"
                aria-label={`${item.name} karşılaştırmadan kaldır`}
                onClick={() => remove(item.id)}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {canCompare ? (
          <Link href={href} className="institution-compare-bar-cta">
            Karşılaştır
          </Link>
        ) : (
          <button type="button" className="institution-compare-bar-cta" disabled>
            Karşılaştır
          </button>
        )}
      </div>
    </div>
  );
}
