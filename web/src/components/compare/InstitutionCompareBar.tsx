"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useInstitutionCompare } from "./InstitutionCompareProvider";

export function InstitutionCompareBar() {
  const pathname = usePathname();
  const { items, remove } = useInstitutionCompare();

  if (pathname === "/karsilastir/kurumlar") return null;
  if (items.length === 0) return null;

  const canCompare = items.length >= 2;
  const href = `/karsilastir/kurumlar?ids=${items.map((item) => item.id).join(",")}`;

  return (
    <div className="institution-compare-bar" role="region" aria-label="Kurum karşılaştırma">
      <div className="institution-compare-bar-inner">
        <div className="institution-compare-bar-copy">
          <p className="institution-compare-bar-title">Karşılaştırma</p>
          <p className="institution-compare-bar-count">{items.length} / 3 kurum</p>
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
                  {item.name.trim().charAt(0).toUpperCase() || "K"}
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
