"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Slider, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ExpandableChat, ExpandableChatHeader, ExpandableChatBody, ExpandableChatFooter } from "@/components/ui";
import { Search as SearchIcon, Wifi, Users, Check, ChevronLeft, ChevronRight, CalendarDays, MapPin, Star, Heart, Building2, Landmark, UserRound, X, Utensils, ShoppingBag, Car, Briefcase, Palette, PawPrint, Sparkle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import BlogCard from "@/components/BlogCard";
import HeaderWithSearch from "@/components/layout/HeaderWithSearch";
import SearchResults from "@/components/SearchResults";
import LoginModal from "@/components/LoginModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FavoritesError, getMyFavoriteInstitutionIds, toggleFavorite } from "@/lib/favorites/favoritesClient";
import { getInstitutionDetailHref } from "@/lib/institutions/getInstitutionDetailHref";
import { getCategoryHref } from "@/lib/categories/getCategoryHref";
import { getCategoryIcon } from "@/lib/categories/getCategoryIcon";
import type { User } from "@supabase/supabase-js";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

const InstitutionLocationsMap = dynamic(
  () => import("@/components/map/InstitutionLocationsMap"),
  { ssr: false }
);


const serviceCards = [
  {
    id: 1,
    title: "Gelecek Spor Akademisi",
    category: "Spor",
    subCategories: ["Futbol", "Basketbol"],
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=300&fit=crop",
    rating: 4.8,
    reviewCount: 125,
    price: 1200,
    slug: "gelecek-spor-akademisi",
  },
  {
    id: 2,
    title: "Aqua Yüzme Kulübü",
    category: "Spor",
    subCategories: ["Yüzme"],
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop",
    rating: 4.9,
    reviewCount: 210,
    price: 950,
    slug: "aqua-yuzme-kulubu",
  },
  {
    id: 3,
    title: "Raket Tenis Okulu",
    category: "Spor",
    subCategories: ["Tenis"],
    imageUrl: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop",
    rating: 4.7,
    reviewCount: 88,
    price: 1500,
    slug: "raket-tenis-okulu",
  },
  {
    id: 4,
    title: "Modern Sanat Atölyesi",
    category: "Sanat",
    subCategories: ["Resim", "Heykel"],
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    rating: 4.6,
    reviewCount: 92,
    price: 800,
    slug: "modern-sanat-atolyesi",
  },
  {
    id: 5,
    title: "Dil Akademisi",
    category: "Dil",
    subCategories: ["İngilizce", "Almanca"],
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop",
    rating: 4.9,
    reviewCount: 156,
    price: 1100,
    slug: "dil-akademisi",
  },
  {
    id: 6,
    title: "Müzik Okulu",
    category: "Müzik",
    subCategories: ["Piyano", "Gitar"],
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop",
    rating: 4.8,
    reviewCount: 203,
    price: 1300,
    slug: "muzik-okulu",
  },
  {
    id: 7,
    title: "Bale ve Dans Stüdyosu",
    category: "Dans",
    subCategories: ["Bale", "Modern Dans"],
    imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop",
    rating: 4.7,
    reviewCount: 145,
    price: 900,
    slug: "bale-ve-dans-studyosu",
  },
  {
    id: 8,
    title: "Kodlama Akademisi",
    category: "Yazılım",
    subCategories: ["Web Geliştirme", "Mobil Uygulama"],
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=300&fit=crop",
    rating: 4.9,
    reviewCount: 312,
    price: 1800,
    slug: "kodlama-akademisi",
  },
  {
    id: 9,
    title: "Kişisel Gelişim Merkezi",
    category: "Kişisel Gelişim",
    subCategories: ["Koçluk", "Liderlik"],
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    rating: 4.8,
    reviewCount: 178,
    price: 1400,
    slug: "kisisel-gelisim-merkezi",
  },
  {
    id: 10,
    title: "Özel Okul",
    category: "Okul",
    subCategories: ["İlkokul", "Ortaokul"],
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
    rating: 4.9,
    reviewCount: 267,
    price: 2500,
    slug: "ozel-okul",
  },
  {
    id: 11,
    title: "Teknoloji Kursu",
    category: "Teknoloji",
    subCategories: ["Robotik", "Yapay Zeka"],
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop",
    rating: 4.7,
    reviewCount: 189,
    price: 1600,
    slug: "teknoloji-kursu",
  },
  {
    id: 12,
    title: "Sağlık ve Wellness",
    category: "Sağlık",
    subCategories: ["Yoga", "Pilates"],
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop",
    rating: 4.8,
    reviewCount: 134,
    price: 1000,
    slug: "saglik-ve-wellness",
  },
];

const categories = [
  { name: "OKUL", icon: "🏫", items: ["Anaokul", "Kreş", "İlkokul", "Ortaokul", "Lise", "Yaz Okulu"], className: "category-card" },
  { name: "SINAVA HAZIRLIK", icon: "📚", items: ["LGS", "Matematik", "Bilgisayar", "TUS"], className: "category-card" },
  { name: "SPOR", icon: "⚽", items: ["Basketbol", "Tenis", "Pilates", "Yüzme"], className: "category-card" },
  { name: "SANAT", icon: "🎨", items: ["Resim", "Müzik", "Dans", "Tiyatro"], className: "category-card" },
  { name: "YABANCI DİL", icon: "🌍", items: ["İngilizce", "Fransızca", "Almanca", "Çince"], className: "category-card" },
  { name: "KİŞİSEL GELİŞİM", icon: "✨", items: ["Makyaj", "Yaşam Koçluğu", "Organik Tarım"], className: "category-card" },
  { name: "MESLEKİ EĞİTİM", icon: "🎯", items: ["Muhasebe", "Pastacılık", "Grafik Tasarım"], className: "category-card" },
  { name: "ÖZEL EĞİTİM", icon: "🧩", items: ["Oyun Terapisi", "Disleksi", "Duyu Bütünleme"], className: "category-card" },
];

const ageOptions = [
  { value: "child", label: "Çocuk (0-17 yaş)", className: "filter-option filter-option-child" },
  { value: "adult", label: "Yetişkin (18+ yaş)", className: "filter-option filter-option-adult" },
];

const serviceOptions = [
  { value: "face", label: "Yüz Yüze", icon: Users },
  { value: "online", label: "Online", icon: Wifi },
];

const schoolStatusOptions = [
  { value: "private", label: "Özel", icon: Building2 },
  { value: "public", label: "Devlet", icon: Landmark },
];

const petFilterGroup = {
  id: "pets",
  title: "Patili Dostlar",
  icon: "🐾",
  headerClassName: "category-header-pets",
  items: ["Pet Otel/Kreş", "Köpek Eğitimi", "Pet Kuaför"],
} as const;

const sidebarCategoryGroups = [
  { id: "school", title: "Okul", icon: "🏫", headerClassName: "category-header-school", items: ["Anaokul/Kreş", "İlkokul", "Ortaokul", "Lise", "Yaz Okulu", "Oyun Grubu"] },
  { id: "exam", title: "Kurs & Sınava Hazırlık", icon: "📚", headerClassName: "category-header-exam", items: ["TUS", "DUS", "KPSS", "YKS", "LGS", "DGS"] },
  { id: "sport", title: "Spor", icon: "⚽", headerClassName: "category-header-sport", items: ["Futbol", "Voleybol", "Basketbol", "Tenis", "Masa Tenisi", "Yüzme"] },
  { id: "art", title: "Sanat", icon: "🎨", headerClassName: "category-header-art", items: ["Resim", "Karakalem", "Yağlı Boya", "Akrilik", "Sulu Boya", "Ahşap Boyama"] },
  { id: "language", title: "Yabancı Dil", icon: "🌍", headerClassName: "category-header-language", items: ["İngilizce", "Almanca", "Fransızca", "Rusça", "İspanyolca", "İtalyanca"] },
  { id: "personal-dev", title: "Kişisel Gelişim", icon: "✨", headerClassName: "category-header-personal-dev", items: ["İletişim", "Duygusal Zeka", "Verimlilik", "Kariyer", "Dil ve İfade", "Teknoloji"] },
  { id: "professional", title: "Mesleki Eğitim", icon: "🎯", headerClassName: "category-header-professional", items: ["Ofis", "Bilişim", "Sağlık/Bakım", "Güzellik/Moda", "El Sanatları", "İnşaat"] },
  { id: "special", title: "Özel Eğitim", icon: "🧩", headerClassName: "category-header-special", items: ["Masal Terapisi", "Oyun Terapisi", "Dil ve Konuşma Terapisi", "ABA Terapi", "Kekemelik", "Afazi"] },
];

const blogPosts = [
  {
    title: "Etkili Zaman Yönetimi İçin 5 İpucu",
    excerpt: "Günlük verimliliğinizi artırmak ve hedeflerinize daha hızlı ulaşmak için bu teknikleri uygulayın.",
    imageUrl: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=450&fit=crop",
    slug: "etkili-zaman-yonetimi-ipuclari",
  },
  {
    title: "Liderlik Becerilerinizi Nasıl Geliştirirsiniz?",
    excerpt: "İyi bir lider olmak doğuştan gelen bir yetenek değil, öğrenilebilen bir beceridir. İşte başlangıç noktaları.",
    imageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=450&fit=crop",
    slug: "liderlik-becerileri-gelistirme",
  },
  {
    title: "Çocuğunuz İçin Doğru Okul Nasıl Seçilir?",
    excerpt: "Okul seçimi yaparken dikkat edilmesi gereken kriterler, eğitim kalitesi ve çocuğunuzun gelişimi için önemli faktörler...",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=450&fit=crop",
    slug: "dogru-okul-secimi",
  },
  {
    title: "LGS'ye Hazırlık: Başarı İçin 10 Altın Kural",
    excerpt: "LGS sınavına etkili hazırlık stratejileri, zaman yönetimi ve motivasyon teknikleri ile başarıya giden yol...",
    imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=450&fit=crop",
    slug: "lgs-hazirlik-altin-kurallar",
  },
  {
    title: "Çocuklarda Spor Alışkanlığı Nasıl Kazandırılır?",
    excerpt: "Çocuğunuzun yaşına uygun spor dalları, fiziksel gelişim ve sosyal beceriler için sporun önemi...",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop",
    slug: "cocuklarda-spor-aliskanligi",
  },
  {
    title: "Sanatın Çocuk Gelişimine Etkisi",
    excerpt: "Resim, müzik ve dans gibi sanat dallarının çocukların yaratıcılık, motor beceri ve duygusal gelişimine katkıları...",
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=450&fit=crop",
    slug: "sanatin-cocuk-gelisimine-etkisi",
  },
];

type FeaturedInstitution = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  imageUrl: string;
  slug: string;
  badge: {
    icon: string;
    label: string;
    color: string;
  };
};

type CategoryRow = {
  id: number;
  name: string | null;
  slug?: string | null;
  is_active?: boolean | null;
};

type CategoryTypeRow = {
  id: number;
  name: string | null;
  category_id: number;
  is_active?: boolean | null;
};

type MainCategoryCard = {
  id: number;
  name: string;
  slug: string;
  subcategories: string[];
};

const featuredInstitutions: FeaturedInstitution[] = [
  {
    id: 1,
    name: "Boğaziçi Koleji",
    location: "İSTANBUL, BEŞİKTAŞ",
    description: "Global vizyonu ve modern eğitim kampüsü ile geleceğin liderlerini yetiştiren prestijli bir kurum.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
    slug: "bogazici-koleji",
    badge: {
      icon: "✓",
      label: "%25 Burs",
      color: "purple"
    }
  },
  {
    id: 2,
    name: "Ankara Bilim Lisesi",
    location: "ANKARA, ÇANKAYA",
    description: "Teknoloji ve bilim odaklı müfredatıyla fark yaratan bir eğitim kurumu.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    slug: "ankara-bilim-lisesi",
    badge: {
      icon: "🎓",
      label: "Fen Lisesi",
      color: "blue"
    }
  },
  {
    id: 3,
    name: "Ege Çağdaş Koleji",
    location: "İZMİR, KONAK",
    description: "Sanat ve spor aktiviteleriyle zenginleştirilmiş, bütünsel gelişim odaklı eğitim anlayışı.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop",
    slug: "ege-cagdas-koleji",
    badge: {
      icon: "🌿",
      label: "Yeşil Kampüs",
      color: "green"
    }
  },
  {
    id: 4,
    name: "Nilüfer Akademi",
    location: "BURSA, NİLÜFER",
    description: "Uluslararası standartlarda yabancı dil eğitimi ve yurt dışı eğitim fırsatları sunan kurum.",
    rating: 5.0,
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
    slug: "nilufer-akademi",
    badge: {
      icon: "🌍",
      label: "Çift Dil",
      color: "purple"
    }
  },
  {
    id: 5,
    name: "İstanbul Teknik Koleji",
    location: "İSTANBUL, KADIKÖY",
    description: "Mühendislik ve teknoloji alanında uzmanlaşmış, çağdaş eğitim yaklaşımıyla öne çıkan kurum.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    slug: "istanbul-teknik-koleji",
    badge: {
      icon: "🔧",
      label: "Teknik",
      color: "blue"
    }
  },
  {
    id: 6,
    name: "Ankara Yabancı Dil Koleji",
    location: "ANKARA, ÇANKAYA",
    description: "Çok dilli eğitim programı ve uluslararası değişim fırsatlarıyla öğrencilerine global vizyon kazandıran kurum.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop",
    slug: "ankara-yabanci-dil-koleji",
    badge: {
      icon: "🗣️",
      label: "Çok Dilli",
      color: "blue"
    }
  },
  {
    id: 7,
    name: "İzmir Sanat Akademisi",
    location: "İZMİR, KONAK",
    description: "Müzik, resim ve tiyatro alanlarında yetenekli öğrencileri keşfeden ve geliştiren sanat odaklı kurum.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=400&fit=crop",
    slug: "izmir-sanat-akademisi",
    badge: {
      icon: "🎨",
      label: "Sanat",
      color: "purple"
    }
  },
  {
    id: 8,
    name: "Ankara Spor Lisesi",
    location: "ANKARA, ÇANKAYA",
    description: "Profesyonel sporcu yetiştirme programı ve modern spor tesisleriyle öne çıkan kurum.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop",
    slug: "ankara-spor-lisesi",
    badge: {
      icon: "⚽",
      label: "Spor",
      color: "green"
    }
  }
];

const premiumPicks = [
  {
    name: "Ankara İstek Koleji",
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=600&fit=crop",
    rating: 4.9,
    reviewCount: "120+",
    location: "İncek, Ankara",
    slug: "ankara-istek-koleji",
  },
  {
    name: "Özel Bilkent Lisesi",
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop",
    rating: 4.8,
    reviewCount: "95+",
    location: "Çankaya, Ankara",
    slug: "ozel-bilkent-lisesi",
  },
  {
    name: "Ankara Bilfen Koleji",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
    rating: 4.9,
    reviewCount: "140+",
    location: "Bilkent, Ankara",
    slug: "ankara-bilfen-koleji",
  },
  {
    name: "TED Ankara Koleji",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&h=600&fit=crop",
    rating: 4.8,
    reviewCount: "180+",
    location: "Çankaya, Ankara",
    slug: "ted-ankara-koleji",
  },
  {
    name: "Çankaya Üniversitesi Koleji",
    imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&h=600&fit=crop",
    rating: 4.7,
    reviewCount: "88+",
    location: "Yıldız, Ankara",
    slug: "cankaya-universitesi-koleji",
  },
  {
    name: "Ankara Fen Lisesi",
    imageUrl: "https://images.unsplash.com/photo-1498243691587-b319d71d3eb4?w=800&h=600&fit=crop",
    rating: 4.9,
    reviewCount: "210+",
    location: "Çankaya, Ankara",
    slug: "ankara-fen-lisesi",
  },
];

const purpleFeatured = [
  {
    id: "ozel-ders",
    badge: "ÖNE ÇIKAN",
    title: "Birebir Özel Ders",
    location: "Çankaya, Ankara",
    cta: "Detayları Gör",
    imageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&h=650&fit=crop",
  },
  {
    id: "yabanci-dil",
    badge: "POPÜLER",
    title: "Yabancı Dil Kursları",
    location: "Kızılay, Ankara",
    cta: "Detayları Gör",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&h=650&fit=crop",
  },
  {
    id: "sinav",
    badge: "TAVSİYE",
    title: "Sınava Hazırlık",
    location: "Bilkent, Ankara",
    cta: "Detayları Gör",
    imageUrl: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?w=900&h=650&fit=crop",
  },
  {
    id: "spor",
    badge: "YENİ",
    title: "Spor Akademileri",
    location: "Ümitköy, Ankara",
    cta: "Detayları Gör",
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=900&h=650&fit=crop",
  },
];

function FeaturedInstitutions({
  onToggleFavorite,
  favoriteIds,
  favoritesEnabled,
  favoriteActionLoadingIds,
  isAuthenticated,
}: {
  onToggleFavorite: (institutionId: number, e: React.MouseEvent) => void;
  favoriteIds: Set<number>;
  favoritesEnabled: boolean;
  favoriteActionLoadingIds: Set<number>;
  isAuthenticated: boolean;
}) {
  const [shuffledFeaturedInstitutions, setShuffledFeaturedInstitutions] = useState(featuredInstitutions);

  useEffect(() => {
    const shuffled = [...featuredInstitutions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledFeaturedInstitutions(shuffled);
  }, []);

  return (
    <section className="featured-institutions-section">
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title">Öne Çıkanlar</h2>
          <p className="featured-institutions-subtitle">Eğitim hayatınızı şekillendirecek en prestijli kurumları keşfedin.</p>
        </div>
      </div>
      <div className="featured-institutions-slider">
        <div className="featured-institutions-scroller">
          {shuffledFeaturedInstitutions.map((institution) => {
            const isFavorite = favoriteIds.has(institution.id);
            const isActionLoading = favoriteActionLoadingIds.has(institution.id);
            return (
              <Link
                key={institution.id}
                href={getInstitutionDetailHref({ id: institution.id, slug: institution.slug })}
                className="featured-institution-card"
                aria-label={`${institution.name} detayları`}
              >
              <div className="featured-institution-image-wrapper">
                <img 
                  src={institution.imageUrl} 
                  alt={institution.name}
                  className="featured-institution-image"
                />
                <div className="featured-institution-overlay" />
                <div className={`featured-institution-badge featured-institution-badge--${institution.badge.color}`}>
                  <span className="featured-institution-badge-label">{institution.badge.label}</span>
                </div>
                <motion.button
                  type="button"
                  aria-label={isFavorite ? "Favorilerden kaldır" : "Favorilere ekle"}
                  className="featured-institution-favorite"
                  whileTap={{ scale: 0.9 }}
                  disabled={isActionLoading || (isAuthenticated && !favoritesEnabled)}
                  onClick={(e) => {
                    onToggleFavorite(institution.id, e);
                  }}
                >
                  <motion.div
                    animate={{ scale: isFavorite ? [1, 1.3, 1] : 1 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <Heart
                      className={isFavorite ? "heart-favorite-icon heart-favorite-icon--active" : "heart-favorite-icon"}
                    />
                  </motion.div>
                </motion.button>
              </div>
              <div className="featured-institution-content">
                <div className="featured-institution-location">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 14 6 14C6 14 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8.25C4.76 8.25 3.75 7.24 3.75 6C3.75 4.76 4.76 3.75 6 3.75C7.24 3.75 8.25 4.76 8.25 6C8.25 7.24 7.24 8.25 6 8.25Z" fill="currentColor"/>
                  </svg>
                  <span>{institution.location}</span>
                </div>
                <h3 className="featured-institution-name">{institution.name}</h3>
                <p className="featured-institution-description" title={institution.description}>{institution.description}</p>
                <div className="featured-institution-footer">
                  <div className="featured-institution-rating">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 0L9.79611 5.52786L15.6085 5.52786L10.9062 8.94427L12.7023 14.4721L8 11.0557L3.29772 14.4721L5.09383 8.94427L0.391548 5.52786L6.20389 5.52786L8 0Z" fill="currentColor"/>
                    </svg>
                    <span>{institution.rating}</span>
                  </div>
                  <span className="featured-institution-link">
                    İncele ›
                  </span>
                </div>
              </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="featured-institutions-view-all">
        <Link href="/okullar">
          Tüm Kurumları Görüntüle →
        </Link>
      </div>
    </section>
  );
}

const premiumPicksMotionVariants = {
  enter: (dir: 1 | -1) => ({
    x: dir * 26,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({
    x: dir * -26,
    opacity: 0,
  }),
};

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set());
  const [favoritesEnabled, setFavoritesEnabled] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoriteActionLoadingIds, setFavoriteActionLoadingIds] = useState<Set<number>>(() => new Set());
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<string>(() => sidebarCategoryGroups[0]?.id ?? "");
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<Set<string>>(new Set());
  const [expandedCategoryCards, setExpandedCategoryCards] = useState<Record<string, boolean>>({});
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  const [selectedSchoolStatus, setSelectedSchoolStatus] = useState<string | null>(null);
  const [selectedAgeOption, setSelectedAgeOption] = useState<string | null>(null);
  const [premiumPicksPage, setPremiumPicksPage] = useState(0);
  const [premiumPicksSlideDir, setPremiumPicksSlideDir] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const [showInstitutionMapModal, setShowInstitutionMapModal] = useState(false);
  const [mainCategoryCards, setMainCategoryCards] = useState<MainCategoryCard[]>([]);
  const mainCategoriesScrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollMainCategoriesLeft, setCanScrollMainCategoriesLeft] = useState(false);
  const [canScrollMainCategoriesRight, setCanScrollMainCategoriesRight] = useState(false);

  const handleFavoriteToggle = async (institutionId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!favoritesEnabled) {
      window.alert("Favoriler yalnızca bireysel hesaplarda kullanılabilir.");
      return;
    }
    if (favoriteActionLoadingIds.has(institutionId)) return;

    const wasFavorited = favoriteIds.has(institutionId);
    setFavoritesError(null);
    setFavoriteActionLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(institutionId);
      return next;
    });
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorited) next.delete(institutionId);
      else next.add(institutionId);
      return next;
    });

    try {
      const res = await toggleFavorite(institutionId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (res.isFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
    } catch (err) {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.add(institutionId);
        else next.delete(institutionId);
        return next;
      });
      const msg =
        err instanceof FavoritesError
          ? err.message
          : "Favori işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.";
      setFavoritesError(msg);
      window.alert(msg);
    } finally {
      setFavoriteActionLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(institutionId);
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        setIsAuthReady(true);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const scroller = mainCategoriesScrollerRef.current;
    if (!scroller) return;

    const updateScrollState = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      setCanScrollMainCategoriesLeft(scroller.scrollLeft > 1);
      setCanScrollMainCategoriesRight(scroller.scrollLeft < maxScrollLeft - 1);
    };

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [mainCategoryCards.length]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady || !user) {
      setFavoriteIds(new Set());
      setFavoritesEnabled(false);
      setFavoritesLoading(false);
      setFavoritesError(null);
      setFavoriteActionLoadingIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    setFavoritesError(null);
    (async () => {
      try {
        const ids = await getMyFavoriteInstitutionIds();
        if (cancelled) return;
        setFavoritesEnabled(true);
        setFavoriteIds(new Set(ids));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof FavoritesError && err.code === "NOT_INDIVIDUAL") {
          setFavoritesEnabled(false);
          setFavoriteIds(new Set());
        } else {
          const msg =
            err instanceof FavoritesError ? err.message : "Favoriler yüklenemedi. Lütfen tekrar deneyin.";
          setFavoritesError(msg);
          setFavoritesEnabled(false);
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    fetch("/api/locations")
      .then((response) => response.json())
      .then((data) => {
        const districtNames = (data?.districts || []).map((district: any) => district.name);
        setDistricts(districtNames);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDistrict) {
      setNeighborhoods([]);
      setSelectedNeighborhood("");
      return;
    }
    fetch("/api/locations")
      .then((response) => response.json())
      .then((data) => {
        const match = (data?.districts || []).find((district: any) => district.name === selectedDistrict);
        setNeighborhoods(match ? match.neighborhoods : []);
      })
      .catch(() => {});
  }, [selectedDistrict]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [categoryRes, typeRes] = await Promise.all([
        supabase
          .from("institution_categories")
          .select("id, name, slug, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("institution_types")
          .select("id, name, category_id, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (cancelled || categoryRes.error || typeRes.error) return;

      const categories = ((categoryRes.data ?? []) as CategoryRow[])
        .map((category) => {
          const name = String(category.name ?? "").trim();
          const slug = String(category.slug ?? "").trim();
          if (!name) return null;
          return {
            id: category.id,
            name,
            slug,
          };
        })
        .filter((category): category is { id: number; name: string; slug: string } => Boolean(category));

      const types = (typeRes.data ?? []) as CategoryTypeRow[];

      const cards = categories.map((category) => {
        const subcategories = types
          .filter((type) => type.category_id === category.id)
          .map((type) => String(type.name ?? "").trim())
          .filter(Boolean);

        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          subcategories,
        };
      });

      setMainCategoryCards(cards);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showInstitutionMapModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInstitutionMapModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showInstitutionMapModal]);

  const handlePriceInput = (index: number, value: string) => {
    const numeric = Math.max(0, Math.min(10000, Number(value) || 0));
    setPriceRange((prev) => {
      const next = [...prev];
      next[index] = numeric;
      if (index === 0 && numeric > next[1]) {
        next[1] = numeric;
      }
      if (index === 1 && numeric < next[0]) {
        next[0] = numeric;
      }
      return next;
    });
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const scrollMainCategories = (direction: 1 | -1) => {
    const scroller = mainCategoriesScrollerRef.current;
    if (!scroller) return;
    const amount = Math.max(220, Math.floor(scroller.clientWidth * 0.8));
    scroller.scrollBy({
      left: direction * amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="page-container">
      <HeaderWithSearch 
        searchValue={query}
        onSearchChange={setQuery}
        showSearchButton={false}
      />

    
      <section className="hero-search">
        <div className="hero-search-container">
          <img 
            src="/images/hero-banner-car.jpg" 
            alt="Hero Banner" 
            className="hero-search-banner"
          />
          <div className="hero-search-overlay"></div>
          <div className="hero-search-content">
            <h1 className="hero-search-title">
              <span className="hero-search-title-white">ÇAYYOLU</span>{" "}
              <span className="hero-search-title-purple">SÜRÜCÜ KURSU</span>
            </h1>
            <p className="hero-search-subtitle">İLETİŞİME GEÇMEYİ UNUTMAYIN!</p>
          </div>
        </div>
      </section>

      <div className="main-layout">
        <aside className="filter-sidebar">
          <Card className="filter-sidebar-card">
            <CardHeader className="filter-sidebar-header">
              <div className="filter-sidebar-header-content">
                <img src="/images/filter.svg" alt="Filtre" className="filter-sidebar-header-icon" />
                <CardTitle className="filter-sidebar-header-title">Filtreler</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="filter-sidebar-content">
              <div className="filter-section filter-section-map">
                <div className="filter-section-map-heading">
                  <div className="filter-section-title filter-section-title--map-row">
                    <Image
                      src="/images/map.svg"
                      alt="Kurum Haritası"
                      width={20}
                      height={20}
                    />
                    <span>Kurum Haritası</span>
                  </div>
                  <button
                    type="button"
                    className="institution-map-detail-link"
                    onClick={() => setShowInstitutionMapModal(true)}
                  >
                    Detaylı incele
                  </button>
                </div>
                <InstitutionLocationsMap key="institution-map-sidebar" />
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/search.svg" 
                    alt="Ara" 
                    width={20} 
                    height={20}
                  />
                  <span>Aranacak Kelime</span>
                </div>
                <div className="search-container">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Hizmet adı, kategori..."
                    className="search-field"
                  />
                  <Button className="search-button">
                    <SearchIcon className="icon-md" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/map.svg" 
                    alt="Lokasyon" 
                    width={20} 
                    height={20}
                  />
                  <span>Lokasyon</span>
                </div>
                <div className="filter-section-inputs">
                  <Select value="ankara" disabled>
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="Şehir Seçin" />
                    </SelectTrigger>
                    <SelectContent className="select-content">
                      <SelectItem value="ankara" className="select-item">
                        Ankara
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="İlçe Seçin" />
                    </SelectTrigger>
                    <SelectContent className="select-content">
                      {districts.map((district) => (
                        <SelectItem key={district} value={district} className="select-item">
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood} disabled={!neighborhoods.length}>
                    <SelectTrigger className="location-input">
                      <SelectValue placeholder="Mahalle Seçin" />
                    </SelectTrigger>
                    <SelectContent className="select-content">
                      {neighborhoods.map((neighborhood) => (
                        <SelectItem key={neighborhood} value={neighborhood} className="select-item">
                          {neighborhood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/services.svg" 
                    alt="Okul Durumu" 
                    width={20} 
                    height={20}
                  />
                  <span>Okul Durumu</span>
                </div>
                <div className="education-type-pills">
                  {schoolStatusOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedSchoolStatus === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`education-type-pill ${isSelected ? 'education-type-pill--selected' : ''}`}
                        onClick={() => {
                          setSelectedSchoolStatus(isSelected ? null : option.value);
                        }}
                      >
                        <Icon className="education-type-pill-icon" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/identification.svg" 
                    alt="Öğrenci Yaşı" 
                    width={20} 
                    height={20}
                  />
                  <span>Öğrenci Yaşı</span>
                </div>
                <div className="filter-section-options">
                  {ageOptions.map((option) => {
                    const isSelected = selectedAgeOption === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${option.className} ${isSelected ? 'filter-option--selected' : ''}`}
                        onClick={() => {
                          setSelectedAgeOption(isSelected ? null : option.value);
                        }}
                      >
                        <span className={`filter-indicator ${isSelected ? 'filter-indicator--checked' : ''}`}>
                          {isSelected && <Check size={14} />}
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/services.svg" 
                    alt="Eğitim Türü" 
                    width={20} 
                    height={20}
                  />
                  <span>Eğitim Türü</span>
                </div>
                <div className="education-type-pills">
                  {serviceOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedServiceType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`education-type-pill ${isSelected ? 'education-type-pill--selected' : ''}`}
                        onClick={() => {
                          setSelectedServiceType(isSelected ? null : option.value);
                        }}
                      >
                        <Icon className="education-type-pill-icon" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="price-filter">
                <div className="price-filter-title">
                  <Image 
                    src="/images/banknotes.svg" 
                    alt="Fiyat" 
                    width={20} 
                    height={20}
                  />
                  <span>Fiyat Filtresi</span>
                </div>
                <div className="price-filter-inputs">
                  <Input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => handlePriceInput(0, e.target.value)}
                    className="price-filter-input"
                  />
                  <span className="price-filter-separator">-</span>
                  <Input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => handlePriceInput(1, e.target.value)}
                    className="price-filter-input"
                  />
                </div>
                <div className="price-filter-slider">
                  <Slider value={priceRange} onValueChange={setPriceRange} min={0} max={10000} step={500} />
                </div>
                <div className="price-filter-labels">
                  <span>0₺</span>
                  <span>5K₺</span>
                  <span>10K₺</span>
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <Image 
                    src="/images/categories.svg" 
                    alt="Kategori" 
                    width={20} 
                    height={20}
                  />
                  <span>Kategori</span>
                </div>
                <Accordion type="single" value={openCategoryId} onValueChange={(v) => setOpenCategoryId(v ?? "")} collapsible>
                  {sidebarCategoryGroups.map((group) => {
                    const isExpanded = expandedCategories.includes(group.id);
                    const hasMore = group.items.length > 4;
                    const itemsToShow = isExpanded ? group.items : group.items.slice(0, hasMore ? 4 : group.items.length);

                    return (
                      <AccordionItem key={group.id} value={group.id} className="category-accordion-item">
                        <AccordionTrigger className="category-accordion-trigger">
                          <span>{group.title}</span>
                        </AccordionTrigger>
                        <AccordionContent className="category-accordion-content">
                          <div className="category-accordion-options">
                            {itemsToShow.map((item) => {
                              const itemKey = `${group.id}-${item}`;
                              const isSelected = selectedCategoryItems.has(itemKey);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  className={`category-option ${isSelected ? "category-option-selected" : ""}`}
                                  onClick={() => {
                                    setSelectedCategoryItems((prev) => {
                                      const next = new Set(prev);
                                      if (isSelected) {
                                        next.delete(itemKey);
                                      } else {
                                        next.add(itemKey);
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                          {hasMore && (
                            <button
                              type="button"
                              className="category-accordion-expand"
                              onClick={() => toggleCategoryExpansion(group.id)}
                            >
                              {isExpanded ? "Daha Az Göster" : "Daha Fazla Göster"}
                            </button>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </CardContent>
          </Card>

          <div className="pet-filter-row">
            <div className="pet-filter-media">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="pet-filter-media-video"
              >
                <source src="/gifs/meko_pet.mp4" type="video/mp4" />
              </video>
            </div>

            <div className="pet-filter-card">
              <div className="pet-filter-header">
                <div className="pet-filter-header-row">
                  <PawPrint className="pet-filter-icon" aria-hidden />
                  <h2 className="pet-filter-title">Patili Dostlar</h2>
                </div>
              </div>
              <div className="pet-filter-main">
                <div className="pet-filter-body">
                  <div className="pet-filter-options">
                    {petFilterGroup.items.map((item) => {
                      const itemKey = `${petFilterGroup.id}-${item}`;
                      const isSelected = selectedCategoryItems.has(itemKey);
                      return (
                        <button
                          key={item}
                          type="button"
                          className={`pet-filter-option ${isSelected ? "pet-filter-option--selected" : ""}`}
                          onClick={() => {
                            setSelectedCategoryItems((prev) => {
                              const next = new Set(prev);
                              if (isSelected) {
                                next.delete(itemKey);
                              } else {
                                next.add(itemKey);
                              }
                              return next;
                            });
                          }}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {query && query.trim().length > 0 ? (
            <SearchResults 
              query={query} 
              onClearSearch={() => setQuery("")}
              onToggleFavorite={handleFavoriteToggle}
              favoriteIds={favoriteIds}
              favoritesEnabled={favoritesEnabled && !favoritesLoading}
              favoriteActionLoadingIds={favoriteActionLoadingIds}
              isAuthenticated={Boolean(user)}
            />
          ) : (
            <>
          <section className="home-main-categories">
            <header className="home-main-categories-header">
              <h2 className="home-main-categories-title">Ana Kategoriler</h2>
              <p className="home-main-categories-subtitle">İhtiyacınıza uygun hizmetleri kolayca bulun</p>
              <div className="home-main-categories-header-nav">
                <button
                  type="button"
                  className="home-main-categories-nav-btn"
                  aria-label="Ana kategorilerde sola kaydır"
                  onClick={() => scrollMainCategories(-1)}
                  disabled={!canScrollMainCategoriesLeft}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="home-main-categories-nav-btn"
                  aria-label="Ana kategorilerde sağa kaydır"
                  onClick={() => scrollMainCategories(1)}
                  disabled={!canScrollMainCategoriesRight}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </header>
            

            <div className="home-main-categories-slider">
              <div className="categories-scroller home-main-categories-grid" ref={mainCategoriesScrollerRef}>
                {mainCategoryCards.map((category) => {
                  const Icon = getCategoryIcon(category.name, category.slug);
                  const categoryHref = getCategoryHref(category.name, category.slug);
                  const cardKey = String(category.id);
                  const isExpanded = Boolean(expandedCategoryCards[cardKey]);
                  const hasMoreThanFour = category.subcategories.length > 4;
                  const sortedSubcategories = [...category.subcategories].sort(
                    (a, b) => a.length - b.length || a.localeCompare(b, "tr")
                  );
                  const visibleSubcategories = isExpanded ? sortedSubcategories : sortedSubcategories.slice(0, 4);
                  return (
                    <article
                      key={category.id}
                      className={`home-main-category-card ${categoryHref ? "home-main-category-card--clickable" : ""}`}
                      onClick={() => {
                        if (!categoryHref) return;
                        router.push(categoryHref);
                      }}
                    >
                      <span className="home-main-category-card-icon" aria-hidden>
                        <Icon size={15} />
                      </span>
                      <h3 className="home-main-category-card-title">{category.name.toLocaleUpperCase("tr-TR")}</h3>
                      {category.subcategories.length > 0 ? (
                        <div className={`home-main-category-card-list-wrap ${isExpanded ? "is-expanded" : ""}`}>
                        <ul className="home-main-category-card-list">
                          {visibleSubcategories.map((subcategory) => (
                            <li key={`${category.id}-${subcategory}`} className="home-main-category-card-item">
                              <Sparkle
                                className="home-main-category-card-item-bullet"
                                size={16}
                                aria-hidden
                                fill="currentColor"
                                stroke="transparent"
                                strokeWidth={0}
                              />
                              <span>{subcategory}</span>
                            </li>
                          ))}
                        </ul>
                        </div>
                      ) : null}
                      {hasMoreThanFour ? (
                        <button
                          type="button"
                          className="home-main-category-card-more-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedCategoryCards((prev) => ({
                              ...prev,
                              [cardKey]: !isExpanded,
                            }));
                          }}
                        >
                          {isExpanded ? "Daha Az Göster" : "Daha Fazla Gör"}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <FeaturedInstitutions
            onToggleFavorite={handleFavoriteToggle}
            favoriteIds={favoriteIds}
            favoritesEnabled={favoritesEnabled && !favoritesLoading}
            favoriteActionLoadingIds={favoriteActionLoadingIds}
            isAuthenticated={Boolean(user)}
          />

          <section>
            <div className="cta-section">
              <h3 className="cta-section-title">Hayatın Merkezinde Olun!</h3>
              <p className="cta-section-subtitle">İhtiyacınız olan tüm hizmetleri tek platformda bulun. Kaliteli hizmet sağlayıcılarıyla tanışın!</p>
              <div className="cta-section-buttons">
                <button className="cta-section-button cta-section-button-primary">
                  ÜCRETSİZ ÜYE OLUN
                </button>
                <button className="cta-section-button cta-section-button-secondary">
                  YAKINIMDAKİ HİZMETLERİ GÖSTER
                </button>
              </div>
            </div>
          </section>

          <section className="announcements-section" aria-label="Duyurular">
            <div className="announcements-header">
              <h2 className="announcements-title">Duyurular</h2>
              <Link href="/blog" className="announcements-view-all">
                tümünü gör
              </Link>
            </div>

            <div className="announcements-grid">
              <Link href="/blog" className="announcement-featured">
                <div
                  className="announcement-featured-media"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=700&fit=crop")',
                  }}
                >
                  <span className="announcement-badge">Yeni</span>
                  <div className="announcement-featured-overlay" />
                  <div className="announcement-featured-body">
                    <h3 className="announcement-featured-title">Eğitimde Bahar Dönemi Kayıtları Başladı</h3>
                    <p className="announcement-featured-desc">
                      Yakınınızdaki kurumları karşılaştırın, fiyat ve hizmet detaylarını tek ekranda inceleyin.
                    </p>
                    <div className="announcement-featured-meta">
                      <span className="announcement-meta-item">
                        <CalendarDays className="announcement-meta-icon" />
                        2 Mart 2026
                      </span>
                      <span className="announcement-meta-item">
                        <MapPin className="announcement-meta-icon" />
                        Ankara
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="announcements-side">
                <Link href="/blog" className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">KAMPANYA</div>
                    <h4 className="announcement-small-title">Üyeliğe Özel İlk Görüşme İndirimi</h4>
                    <p className="announcement-small-desc">
                      Seçili kurumlarda tanışma dersleri ve değerlendirme görüşmeleri avantajlı.
                    </p>
                  </div>
                </Link>

                <Link href="/blog" className="announcement-small">
                  <div
                    className="announcement-small-thumb"
                    style={{
                      backgroundImage:
                        'url("https://images.unsplash.com/photo-1454165205744-3b78555e5572?w=600&h=400&fit=crop")',
                    }}
                  />
                  <div className="announcement-small-body">
                    <div className="announcement-small-kicker">BİLGİLENDİRME</div>
                    <h4 className="announcement-small-title">Yeni Filtreler ve Arama Deneyimi</h4>
                    <p className="announcement-small-desc">
                      Lokasyon, fiyat ve kategori filtreleriyle en uygun seçeneklere daha hızlı ulaşın.
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          <section className="blog-section">
            <div className="blog-section-header">
              <h2 className="blog-section-title">Blog Yazıları</h2>
              <p className="blog-section-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
            </div>
            <div className="blog-section-grid">
              {blogPosts.slice(0, 3).map((post, index) => (
                <BlogCard
                  key={index}
                  title={post.title}
                  excerpt={post.excerpt}
                  imageUrl={post.imageUrl}
                  slug={post.slug}
                />
              ))}
            </div>
            <div className="blog-section-button-wrapper">
              <Link href="/blog">
                <button className="blog-section-button">
                  Daha fazlasını gör
                </button>
              </Link>
        </div>
          </section>
            </>
          )}
      </main>
      </div>
      <div className="content-layout">
        <div className="content-layout-inner">
          <section className="purple-featured-section" aria-label="Hızlı Keşif">
            <div className="purple-featured-bg" aria-hidden />
            <div className="purple-featured-inner">
              <div className="purple-featured-heading">
                <span className="purple-featured-kicker">Yabancı Dil İçin Özenle Seçildi</span>
                <h2 className="purple-featured-title">Dil Eğitiminde Fark Yaratanlar</h2>
              </div>

              <div className="purple-featured-cards">
                {purpleFeatured.map((card, idx) => (
                  <Link key={card.id} href="/okullar" className="purple-featured-card" aria-label={card.title}>
                    <div className="purple-featured-card-media">
                      <img className="purple-featured-card-img" src={card.imageUrl} alt={card.title} />
                      <span className="purple-featured-card-badge">{card.badge}</span>
                    </div>
                    <div className="purple-featured-card-body">
                      <h3 className="purple-featured-card-title">{card.title}</h3>
                      <div className="purple-featured-card-location">
                        <MapPin className="purple-featured-card-location-icon" aria-hidden />
                        <span>{card.location}</span>
                      </div>
                      <div className="purple-featured-card-cta">{card.cta} ›</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="premium-picks-section" aria-label="Ankara'nın En İyileri">
            <div className="premium-picks-header">
              <div className="premium-picks-header-text">
                <span className="premium-picks-badge">PREMIUM KEŞİF</span>
                <h2 className="premium-picks-title">Ankara'nın En İyileri</h2>
                <p className="premium-picks-desc">Başkentin en prestijli eğitim kurumlarını keşfedin.</p>
              </div>
              <div className="premium-picks-nav" aria-hidden>
                <button
                  type="button"
                  className="premium-picks-nav-btn premium-picks-nav-btn--prev"
                  aria-label="Önceki"
                  onClick={() => {
                    setPremiumPicksSlideDir(-1);
                    setPremiumPicksPage((p) => (p - 1 + 2) % 2);
                  }}
                >
                  <ChevronLeft className="premium-picks-nav-icon" />
                </button>
                <button
                  type="button"
                  className="premium-picks-nav-btn premium-picks-nav-btn--next"
                  aria-label="Sonraki"
                  onClick={() => {
                    setPremiumPicksSlideDir(1);
                    setPremiumPicksPage((p) => (p + 1) % 2);
                  }}
                >
                  <ChevronRight className="premium-picks-nav-icon" />
                </button>
              </div>
            </div>
            <div className="premium-picks-cards">
              <AnimatePresence mode="wait" initial={false} custom={premiumPicksSlideDir}>
                <motion.div
                  key={premiumPicksPage}
                  custom={premiumPicksSlideDir}
                  variants={premiumPicksMotionVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.16, ease: [0.4, 0, 0.2, 1] }
                  }
                  className="premium-picks-cards-track"
                >
                  {premiumPicks.slice(premiumPicksPage * 3, premiumPicksPage * 3 + 3).map((item) => (
                    <Link key={item.slug} href={`/okullar/${item.slug}`} className="premium-picks-card">
                      <div
                        className="premium-picks-card-media"
                        style={{ backgroundImage: `url("${item.imageUrl}")` }}
                      >
                        <span className="premium-picks-card-badge">TOP PICK</span>
                        <div className="premium-picks-card-overlay" />
                        <div className="premium-picks-card-info">
                          <h3 className="premium-picks-card-title">{item.name}</h3>
                          <div className="premium-picks-card-rating">
                            <Star className="premium-picks-card-star" fill="currentColor" aria-hidden />
                            <span>{item.rating}</span>
                            <span className="premium-picks-card-reviews">({item.reviewCount} Değerlendirme)</span>
                          </div>
                          <p className="premium-picks-card-location">{item.location}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

        </div>
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {showInstitutionMapModal ? (
        <div className="institution-map-modal-root" role="presentation">
          <button
            type="button"
            className="institution-map-modal-backdrop"
            aria-label="Haritayı kapat"
            onClick={() => setShowInstitutionMapModal(false)}
          />
          <div
            className="institution-map-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="institution-map-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="institution-map-modal-header">
              <h2 id="institution-map-modal-title" className="institution-map-modal-title">
                Kurum Haritası
              </h2>
              <button
                type="button"
                className="institution-map-modal-close"
                onClick={() => setShowInstitutionMapModal(false)}
                aria-label="Kapat"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <div className="institution-map-modal-body">
              <InstitutionLocationsMap key="institution-map-modal" variant="modal" />
            </div>
          </div>
        </div>
      ) : null}

      <ExpandableChat
        size="lg"
        position="bottom-right"
        icon={(
          <video
            className="expandable-chat-toggle-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          >
            <source src="/gifs/meko_soru.mp4" type="video/mp4" />
          </video>
        )}
      >
        <ExpandableChatHeader>
          <h2 className="expandable-chat-header-title">Bize ulaşın</h2>
        </ExpandableChatHeader>
        <ExpandableChatBody>
          <div className="expandable-chat-starter">
            <div className="expandable-chat-starter-avatar" aria-hidden>
              <UserRound size={16} />
            </div>
            <div className="expandable-chat-starter-bubble">
              <p className="expandable-chat-starter-text">
                Sorularınız için bize iletişim sayfamız üzerinden ulaşabilirsiniz!
              </p>
            </div>
          </div>
        </ExpandableChatBody>
        <ExpandableChatFooter>
          <form
            className="expandable-chat-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              type="text"
              placeholder="Mesajınızı yazın..."
              className="expandable-chat-input"
              aria-label="Mesaj"
            />
            <Button type="submit" variant="default" className="expandable-chat-send-btn">
              Gönder
            </Button>
          </form>
        </ExpandableChatFooter>
      </ExpandableChat>
    </div>
  );
}
