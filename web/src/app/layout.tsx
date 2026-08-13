import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Footer from "@/components/layout/Footer";
import { ClampedTextTooltipGlobal } from "@/components/ClampedTextTooltipGlobal";
import { InstitutionCompareProvider } from "@/components/compare/InstitutionCompareProvider";
import { InstitutionCompareBar } from "@/components/compare/InstitutionCompareBar";
import { resolveSiteUrl } from "@/lib/seo/siteUrl";
import "@/styles/main.scss";
import "@/styles/components/app-modal.scss";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: "MERKEZDEN - Hayatın Merkezi",
  description: "Ankara'da eğitim kurumları, kurslar ve hizmetleri bulun. AI destekli arama ile ihtiyacınız olan hizmeti kolayca keşfedin.",
  icons: {
    icon: [{ url: "/images/merkezden-logo.svg?v=1", type: "image/svg+xml", sizes: "any" }],
    shortcut: ["/images/merkezden-logo.svg?v=1"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${plusJakartaSans.variable}`}
      >
        <InstitutionCompareProvider>
          {children}
          <InstitutionCompareBar />
          <ClampedTextTooltipGlobal />
          <Footer />
        </InstitutionCompareProvider>
      </body>
    </html>
  );
}
