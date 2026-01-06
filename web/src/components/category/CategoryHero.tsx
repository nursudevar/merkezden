"use client";

import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import CategoryBreadcrumb from "./CategoryBreadcrumb";
import CategorySearchBar from "./CategorySearchBar";

const categoryData: Record<string, { title: string; description: string }> = {
  school: {
    title: "Okul",
    description: "Anaokulu, Kreş, İlkokul, Ortaokul, Lise, Yaz Okulu ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  courses: {
    title: "Kurs & Sınava Hazırlık",
    description: "LGS, Matematik, TUS, DUS, Bilgisayar, Fizik, Kimya, Biyoloji, Türkçe, Matematik, Sosyal Bilimler, Dil ve Anlatım ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  sports: {
    title: "Spor Eğitim Kurumları",
    description: "Futbol, Basketbol, Tenis, Buz Pateni, Yüzme, Atletizm, Judo, Taekwondo, Voleybol, Handbol ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  arts: {
    title: "Sanat Eğitim Kurumları",
    description: "Resim, Müzik, Dans, Tiyatro, Performans ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  languages: {
    title: "Yabancı Dil Eğitim Kurumları",
    description: "İngilizce, Fransızca, Almanca, Çince, Rusça, İspanyolca, İtalyanca ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  "personal-development": {
    title: "Kişisel Gelişim",
    description: "Makyaj, Yaşam Koçluğu, Duygusal Zeka, Verimlilik, Kariyer, Dil ve İfade, Organik Tarım ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  "vocational-training": {
    title: "Mesleki Eğitim",
    description: "Muhasebe, Pastacılık, Grafik Tasarım, El Sanatları ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
  "special-education": {
    title: "Özel Eğitim",
    description: "Oyun Terapisi, Disleksi, Duyu Bütünleme, ABA Terapi, Kekemelik, Afazi ve daha fazlası için en iyi eğitim kurumlarını keşfedin.",
  },
};

function getCategoryData(pathname: string): { title: string; description: string } {
  const slug = pathname.split("/").pop() || "";
  
  if (categoryData[slug]) {
    return categoryData[slug];
  }
  
  // Fallback: derive from slug
  const fallbackTitle = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  return {
    title: `${fallbackTitle} Eğitim Kurumları`,
    description: `${fallbackTitle} kategorisindeki eğitim kurumlarını keşfedin. İhtiyacınıza uygun en iyi seçenekleri bulun.`,
  };
}

export default function CategoryHero() {
  const pathname = usePathname();
  const { title, description } = getCategoryData(pathname);

  return (
    <section className="category-hero">
      <div className="category-hero-container">
        <div className="category-hero-breadcrumb-wrapper">
          <CategoryBreadcrumb />
        </div>
        <div className="category-hero-content">
        <div className="category-hero-badge">
          <GraduationCap size={20} />
        </div>
          <h1 className="category-hero-title">{title}</h1>
          <p className="category-hero-subtitle">{description}</p>
        </div>
        <div className="category-hero-search-wrapper">
          <CategorySearchBar />
        </div>
      </div>
    </section>
  );
}

