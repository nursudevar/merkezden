"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/** Ana sayfa header ile birebir aynı logo (src, boyut, sınıflar). */
export const HEADER_BRAND_LOGO_WIDTH = 440;
export const HEADER_BRAND_LOGO_HEIGHT = 88;

export default function HeaderBrandLogo() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <Link
      href="/"
      className="header-title-link"
      onClick={(e) => {
        if (!isHome) return;
        e.preventDefault();
        window.location.reload();
      }}
    >
      <Image
        src="/images/merkezden-logo.svg"
        alt="Merkezden"
        width={HEADER_BRAND_LOGO_WIDTH}
        height={HEADER_BRAND_LOGO_HEIGHT}
        className="header-logo"
        priority
      />
    </Link>
  );
}
