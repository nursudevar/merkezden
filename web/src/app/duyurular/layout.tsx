import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eğitim Kurumları ve Eğitmenlerden Güncel Duyurular | Merkezden",
  description:
    "Eğitim kurumları ve eğitmenlerden güncel duyuruları, etkinlikleri, kayıt dönemlerini ve bilgilendirmeleri Merkezden'de takip edin.",
};

export default function DuyurularLayout({ children }: { children: React.ReactNode }) {
  return children;
}
