import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Footer from "@/components/layout/Footer";
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
    icon: [{ url: "/images/merkezden-logo.png?v=3", type: "image/png", sizes: "any" }],
    shortcut: ["/images/merkezden-logo.png?v=3"],
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
        <Footer />
      </body>
    </html>
  );
}
