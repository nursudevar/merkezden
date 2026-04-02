import Link from "next/link";
import Image from "next/image";

/** Ana sayfa header ile birebir aynı logo (src, boyut, sınıflar). */
export const HEADER_BRAND_LOGO_WIDTH = 440;
export const HEADER_BRAND_LOGO_HEIGHT = 88;

export default function HeaderBrandLogo() {
  return (
    <Link href="/" className="header-title-link">
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
