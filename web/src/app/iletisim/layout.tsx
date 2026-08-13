import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim | Merkezden",
  description:
    "Merkezden ile iletişime geçin; soru, görüş ve destek taleplerinizi bize iletin.",
};

export default function IletisimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
