"use client";

import { GraduationCap, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import CategoryResultsCard from "./CategoryResultsCard";

interface CategoryResultsListProps {
  categoryName: string;
  subtitle?: string;
  results?: Array<{
    id: string;
    name: string;
    description: string;
    location: string;
    price: string | number;
    ageRange: string;
    rating: number;
    reviewCount: number;
    badges: string[];
    logoInitial?: string;
    logoColor?: string;
    imageUrl?: string;
    slug?: string;
  }>;
}

const mockResults = [
  {
    id: "1",
    name: "Montessori Çocuk Akademisi",
    description: "Çocuk merkezli eğitim yaklaşımı ile uluslararası standartlarda Montessori eğitimi. Geniş bahçe ve doğal materyaller.",
    location: "Kadıköy, İstanbul",
    price: 8500,
    ageRange: "3-6 Yaş",
    rating: 4.9,
    reviewCount: 120,
    badges: ["ÖZEL OKUL", "ANAOKULU"],
    logoInitial: "M",
    logoColor: "#6d5dfc",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=200&h=200&fit=crop",
    slug: "montessori-cocuk-akademisi",
  },
  {
    id: "2",
    name: "Waldorf Doğa Koleji",
    description: "Sanat ve zanaat odaklı, doğa ile iç içe, bütünsel bir eğitim modeli. Bireysel yetenekleri keşfetme odaklı.",
    location: "Beşiktaş, İstanbul",
    price: 12000,
    ageRange: "7-11 Yaş",
    rating: 4.8,
    reviewCount: 85,
    badges: ["ÖZEL OKUL", "İLKOKUL"],
    logoInitial: "W",
    logoColor: "#10b981",
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=200&h=200&fit=crop",
    slug: "waldorf-doga-koleji",
  },
  {
    id: "3",
    name: "Galata Fen Lisesi",
    description: "Sayısal alanda uzmanlaşmış köklü eğitim kadrosu ve modern laboratuvar imkanları ile geleceğin bilim insanlarını yetiştiriyoruz.",
    location: "Beyoğlu, İstanbul",
    price: "Ücretsiz",
    ageRange: "14-18 Yaş",
    rating: 4.7,
    reviewCount: 210,
    badges: ["DEVLET", "LİSE"],
    logoInitial: "G",
    logoColor: "#f97316",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200&h=200&fit=crop",
    slug: "galata-fen-lisesi",
  },
];

export default function CategoryResultsList({ categoryName, subtitle, results = mockResults }: CategoryResultsListProps) {
  return (
    <div className="category-results-list">
      <div className="category-results-header">
        <div className="category-results-header-left">
          <div className="category-results-title-wrapper">
            <GraduationCap size={24} className="category-results-title-icon" />
            <h2 className="category-results-title">Eğitim Kurumları</h2>
          </div>
          <p className="category-results-subtitle">
            {subtitle || "İstanbul bölgesinde öne çıkan en iyi eğitim kurumlarını inceleyin."}
          </p>
        </div>
        <div className="category-results-sort">
          <span className="category-results-sort-label">Sırala:</span>
          <Select defaultValue="recommended">
            <SelectTrigger className="category-results-sort-select">
              <SelectValue placeholder="Önerilenler" />
            </SelectTrigger>
            <SelectContent className="select-content">
              <SelectItem value="recommended" className="select-item">Önerilenler</SelectItem>
              <SelectItem value="rating" className="select-item">En Yüksek Puan</SelectItem>
              <SelectItem value="price-low" className="select-item">Fiyat: Düşükten Yükseğe</SelectItem>
              <SelectItem value="price-high" className="select-item">Fiyat: Yüksekten Düşüğe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="category-results-cards">
        {results.map((result) => (
          <CategoryResultsCard key={result.id} {...result} />
        ))}
      </div>
    </div>
  );
}

