"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import {
  QUICK_ACCESS_CATEGORIES,
  QUICK_ACCESS_FOOTER,
  QUICK_ACCESS_PRIMARY,
  isQuickAccessNavActive,
  shouldShowAppSidebar,
  type QuickAccessNavItem,
} from "@/lib/quickAccessNav";
import { AppSidebarLocation } from "@/components/layout/AppSidebarLocation";

function isSidebarInteractiveRegion(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return Boolean(
    node.closest(".app-sidebar") || node.closest(".app-sidebar-location-select-content"),
  );
}

function SidebarLink({
  item,
  expanded,
}: {
  item: QuickAccessNavItem;
  expanded: boolean;
}) {
  const pathname = usePathname();
  const active = isQuickAccessNavActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`app-sidebar-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : item.label}
      aria-label={item.label}
    >
      <span className="app-sidebar-link-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={1.85} />
      </span>
      <span className="app-sidebar-link-label">{item.label}</span>
    </Link>
  );
}

function SidebarNavGroup({
  items,
  expanded,
  label,
}: {
  items: readonly QuickAccessNavItem[];
  expanded: boolean;
  label?: string;
}) {
  return (
    <div className="app-sidebar-group" role="group" aria-label={label}>
      {label ? <p className="app-sidebar-group-label">{label}</p> : null}
      <ul className="app-sidebar-list">
        {items.map((item) => (
          <li key={item.id}>
            <SidebarLink item={item} expanded={expanded} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppSidebarChrome({
  top,
  isDesktop,
}: {
  top: number;
  isDesktop: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const selectOpenRef = useRef(false);

  // Select portal sidebar DOM'unda değil; açıkken geniş kalmalı (kalıcı pin değil).
  const expanded = hovered || selectOpen;

  useEffect(() => {
    selectOpenRef.current = selectOpen;
  }, [selectOpen]);

  const handleSelectOpenChange = (open: boolean) => {
    setSelectOpen(open);
    if (open) {
      setHovered(true);
      return;
    }
    // Select kapandı (Radix); pointer sidebar dışındaysa hover'ı da bırak.
    if (!asideRef.current?.matches(":hover")) {
      setHovered(false);
    }
  };

  return (
    <aside
      ref={asideRef}
      className={`app-sidebar${expanded ? " is-expanded" : ""}`}
      style={{ top }}
      aria-label="Hızlı erişim"
      aria-hidden={!isDesktop}
      inert={!isDesktop ? true : undefined}
      onMouseEnter={() => {
        if (isDesktop) setHovered(true);
      }}
      onMouseLeave={(event) => {
        if (isSidebarInteractiveRegion(event.relatedTarget)) return;
        // Yalnızca hover'ı bırak. selectOpen'ı Radix onOpenChange kapatır;
        // expanded = hovered || selectOpen → açık Select sırasında editör unmount olmaz.
        setHovered(false);
      }}
      onFocusCapture={() => {
        if (isDesktop) setHovered(true);
      }}
      onBlurCapture={(event) => {
        if (selectOpenRef.current) return;
        const next = event.relatedTarget;
        if (next == null) return;
        if (isSidebarInteractiveRegion(next)) return;
        setHovered(false);
      }}
    >
      <div className="app-sidebar-inner">
        <div className="app-sidebar-top">
          <div className="app-sidebar-kesfet" aria-label="Keşfet">
            <span className="app-sidebar-kesfet-icon" aria-hidden="true">
              <PanelRightOpen size={18} strokeWidth={1.85} />
            </span>
            <span className="app-sidebar-kesfet-label">Keşfet</span>
          </div>

          <AppSidebarLocation
            expanded={expanded}
            onSelectOpenChange={handleSelectOpenChange}
          />
        </div>

        <nav className="app-sidebar-nav" aria-label="Kategoriler ve sayfalar">
          <SidebarNavGroup
            items={QUICK_ACCESS_CATEGORIES}
            expanded={expanded}
            label={expanded ? "Kategoriler" : undefined}
          />
          <div className="app-sidebar-divider" role="separator" />
          <SidebarNavGroup items={QUICK_ACCESS_PRIMARY} expanded={expanded} />
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-divider" role="separator" />
          <SidebarNavGroup items={QUICK_ACCESS_FOOTER} expanded={expanded} />
        </div>
      </div>
    </aside>
  );
}

/**
 * Masaüstü sol gezinme: floating kart (48px / 200px). Hover ile açılır; pointer çıkınca kapanır.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const visible = shouldShowAppSidebar(pathname);
  const [top, setTop] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!visible) {
      document.body.classList.add("app-sidebar-disabled");
    } else {
      document.body.classList.remove("app-sidebar-disabled");
    }
    return () => document.body.classList.remove("app-sidebar-disabled");
  }, [visible]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!visible || !isDesktop) return;

    const updateTop = () => {
      const header = document.querySelector<HTMLElement>(".header");
      if (!header) {
        setTop(12);
        return;
      }
      setTop(Math.max(12, header.getBoundingClientRect().bottom + 12));
    };

    updateTop();
    window.addEventListener("scroll", updateTop, { passive: true });
    window.addEventListener("resize", updateTop);

    const header = document.querySelector(".header");
    const ro = header ? new ResizeObserver(updateTop) : null;
    if (header && ro) ro.observe(header);

    return () => {
      window.removeEventListener("scroll", updateTop);
      window.removeEventListener("resize", updateTop);
      ro?.disconnect();
    };
  }, [visible, pathname, isDesktop]);

  if (!visible) return null;

  return <AppSidebarChrome key={pathname} top={top} isDesktop={isDesktop} />;
}
