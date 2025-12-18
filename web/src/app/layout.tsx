import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Footer from "@/components/layout/Footer";
import "@/styles/main.scss";

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
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
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
