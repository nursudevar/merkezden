import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Footer from "@/components/layout/Footer";
import { ClampedTextTooltipGlobal } from "@/components/ClampedTextTooltipGlobal";
import "@/styles/main.scss";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
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
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable}`}
      >
        {children}
        <ClampedTextTooltipGlobal />
        <Footer />
      </body>
    </html>
  );
}
