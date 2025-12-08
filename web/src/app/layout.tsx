import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Footer from "@/components/layout/Footer";
import "@/styles/main.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
