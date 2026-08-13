import type { ComponentType } from "react";
import {
  BarChart3,
  Check,
  FileText,
  ImagePlus,
  ListFilter,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
  Star,
  Table2,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type SignupFeatureItem = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export const INDIVIDUAL_SIGNUP_FEATURES: SignupFeatureItem[] = [
  {
    title: "Haritada Arama",
    description: "Konumunuza yakın kurumları harita üzerinde bulun",
    icon: MapPinned,
  },
  {
    title: "Akıllı Asistan",
    description: "MEKO AI destekli önerileri alın",
    icon: Sparkles,
  },
  {
    title: "Filtreli Listeleme",
    description: "Kriterlerinize uygun kurumlara hızlıca ulaşın.",
    icon: ListFilter,
  },
  {
    title: "Karşılaştırma Tablosu",
    description: "Kurumları karşılaştırın, size en uygun seçimi yapın.",
    icon: Table2,
  },
  {
    title: "Size Özel Avantajlar",
    description: "İndirim ve kampanyalardan yararlanın.",
    icon: Tags,
  },
  {
    title: "Detaylı İnceleme",
    description: "Kapsamlı bilgileri inceleyip değerlendirin",
    icon: Search,
  },
];

export const CORPORATE_SIGNUP_FEATURES: SignupFeatureItem[] = [
  {
    title: "Detaylı Profil Sayfası",
    description: "Kurumunuzun tüm nitelikleriyle tercih edilen olun.",
    icon: FileText,
  },
  {
    title: "Duyuru/Kampanya Paylaşma",
    description: "Başarı, yenilik ve tüm etkinliklerinizi paylaşın.",
    icon: Megaphone,
  },
  {
    title: "Fotoğraf/Video Ekleme",
    description: "Görsel verileriniz ile güncelliğinizi sürdürün.",
    icon: ImagePlus,
  },
  {
    title: "SEO Avantajları",
    description: "Merkezden.com sayesinde Google'da Görünürlüğünüzü Arttırın",
    icon: Search,
  },
  {
    title: "Potansiyel Öğrenci Analizi",
    description: "Ziyaretçi verilerinizi analiz edin, stratejinizi güçlendirin.",
    icon: BarChart3,
  },
  {
    title: "Öne Çıkanlar Sayfası",
    description: "Daha fazla öğrenciye ulaşın.",
    icon: Star,
  },
];

export const INSTRUCTOR_SIGNUP_FEATURES: SignupFeatureItem[] = [
  {
    title: "Profesyonel Profil Sayfası",
    description: "Nitelikleriniz, deneyimleriniz ve eğitim bilgileriniz ile tercih edilen olun.",
    icon: UserRound,
  },
  {
    title: "Fiyat Avantajı",
    description: "Uygun üyelik paketleriyle sadece eğitim kalitenize odaklanın.",
    icon: Wallet,
  },
  {
    title: "Seo Avantajları",
    description: "Merkezden.com sayesinde Google’da görünürlüğünüzü arttırın.",
    icon: TrendingUp,
  },
  {
    title: "Geniş Eğitim Kitlesi",
    description: "Türkiye’nin eğitim ekosistemine yön verenler arasında yerinizi alın.",
    icon: Users,
  },
  {
    title: "AI Asistan",
    description: "Meko AI algoritması ile öne çıkın.",
    icon: Sparkles,
  },
  {
    title: "Onaylı Eğitmen",
    description: "Nitelikli ve doğrulanmış eğitmenlerden oluşan profesyonel bir topluluğun parçası olun.",
    icon: Check,
  },
];
