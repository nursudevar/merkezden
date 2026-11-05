"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  QUICK_ACCESS_ALL,
  isQuickAccessNavActive,
} from "@/lib/quickAccessNav";

type QuickAccessMobileAccordionProps = {
  onNavigate?: () => void;
};

/** Mobil hamburger içi “Hızlı Erişim” accordion — mevcut menü stillerini kullanır. */
export function QuickAccessMobileAccordion({ onNavigate }: QuickAccessMobileAccordionProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const buttonId = `${baseId}-btn`;

  return (
    <div className={`header-hizli-erisim${open ? " is-open" : ""}`}>
      <button
        type="button"
        id={buttonId}
        className="header-hizli-erisim-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span>Hızlı Erişim</span>
        <ChevronDown className="header-hizli-erisim-chevron" aria-hidden size={18} />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="header-hizli-erisim-panel"
        hidden={!open}
      >
        <ul className="header-hizli-erisim-list">
          {QUICK_ACCESS_ALL.map((item) => {
            const Icon = item.icon;
            const active = isQuickAccessNavActive(pathname, item.href);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`header-hamburger-link header-hizli-erisim-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                >
                  <Icon className="header-hamburger-icon" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
