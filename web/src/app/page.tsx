"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Slider, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Search as SearchIcon } from "lucide-react";
import BlogCard from "@/components/BlogCard";
import HeaderWithSearch from "@/components/layout/HeaderWithSearch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import FeaturedInstitutionsSkeleton from "@/components/FeaturedInstitutionsSkeleton";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

const FeaturedInstitutions = dynamic(() => import("@/components/FeaturedInstitutions"), {
  ssr: false,
  loading: () => <FeaturedInstitutionsSkeleton />
});


// Main categories for pills
const mainCategories = [
  "Tümü",
  "Okul",
  "Spor",
  "Teknoloji",
  "Sanat",
  "Dil",
  "Müzik",
  "Dans",
  "Yazılım",
  "Kişisel Gelişim",
  "Sağlık",
];

// Service cards data
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
  { value: "child", label: "👶 Çocuk (0-17 yaş)", className: "filter-option filter-option-child" },
  { value: "adult", label: "🧑‍🎓 Yetişkin (18+ yaş)", className: "filter-option filter-option-adult" },
];

const serviceOptions = [
  { value: "online", label: "💻 Online", className: "filter-option filter-option-online" },
  { value: "face", label: "🏫 Yüz Yüze", className: "filter-option filter-option-face" },
  { value: "group", label: "👥 Grup", className: "filter-option filter-option-group" },
  { value: "personal", label: "🧑‍🏫 Bireysel", className: "filter-option filter-option-personal" },
];

const categoryGroups = [
  { id: "school", title: "Okul", icon: "🏫", headerClassName: "category-header-school", items: ["Anaokul/Kreş", "İlkokul", "Ortaokul", "Lise", "Yaz Okulu", "Oyun Grubu"] },
  { id: "exam", title: "Kurs & Sınava Hazırlık", icon: "📚", headerClassName: "category-header-exam", items: ["TUS", "DUS", "KPSS", "YKS", "LGS", "DGS"] },
  { id: "sport", title: "Spor", icon: "⚽", headerClassName: "category-header-sport", items: ["Futbol", "Voleybol", "Basketbol", "Tenis", "Masa Tenisi", "Yüzme"] },
  { id: "art", title: "Sanat", icon: "🎨", headerClassName: "category-header-art", items: ["Resim", "Karakalem", "Yağlı Boya", "Akrilik", "Sulu Boya", "Ahşap Boyama"] },
  { id: "language", title: "Yabancı Dil", icon: "🌍", headerClassName: "category-header-language", items: ["İngilizce", "Almanca", "Fransızca", "Rusça", "İspanyolca", "İtalyanca"] },
  { id: "personal-dev", title: "Kişisel Gelişim", icon: "✨", headerClassName: "category-header-personal-dev", items: ["İletişim", "Duygusal Zeka", "Verimlilik", "Kariyer", "Dil ve İfade", "Teknoloji"] },
  { id: "professional", title: "Mesleki Eğitim", icon: "🎯", headerClassName: "category-header-professional", items: ["Ofis", "Bilişim", "Sağlık/Bakım", "Güzellik/Moda", "El Sanatları", "İnşaat"] },
  { id: "special", title: "Özel Eğitim", icon: "🧩", headerClassName: "category-header-special", items: ["Masal Terapisi", "Oyun Terapisi", "Dil ve Konuşma Terapisi", "ABA Terapi", "Kekemelik", "Afazi"] },
  { id: "pets", title: "Patili Dostlar", icon: "🐾", headerClassName: "category-header-pets", items: ["Pet Otel/Kreş", "Köpek Eğitimi", "Pet Kuaför"] },
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

function FilterIndicator() {
  return <span className="filter-indicator" />;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<Set<string>>(new Set());
  const [expandedCategoryCards, setExpandedCategoryCards] = useState<Record<string, boolean>>({});
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("Tümü");
  const categoriesScrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

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

  const scrollCategoriesByDelta = (direction: number) => {
    if (!categoriesScrollerRef.current) return;
    const scroller = categoriesScrollerRef.current;
    const scrollAmount = scroller.clientWidth * 0.5;
    scroller.scrollBy({
      left: direction * scrollAmount,
      behavior: "smooth",
    });
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <div className="page-container">
      <HeaderWithSearch 
        initialUser={user} 
        searchValue={query}
        onSearchChange={setQuery}
      />

      <section className="hero-search">
        <div className="hero-search-container">
          <img 
            src="/images/hero-car-banner.png" 
            alt="Hero Banner" 
            className="hero-search-banner"
          />
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
                    src="/images/identification.svg" 
                    alt="Öğrenci Yaşı" 
                    width={20} 
                    height={20}
                  />
                  <span>Öğrenci Yaşı</span>
                </div>
                <div className="filter-section-options">
                  {ageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.className}
                    >
                      <FilterIndicator />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <span>🔧</span>
                  <span>Hizmet Tipi</span>
                </div>
                <div className="filter-section-options">
                  {serviceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.className}
                    >
                      <FilterIndicator />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <span>📁</span>
                  <span>Kategori</span>
                </div>
                <Accordion type="multiple" defaultValue={categoryGroups.slice(0, 2).map((group) => group.id)}>
                  {categoryGroups.map((group) => {
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
        </aside>

        <main className="main-content">
          <section className="home-main-categories">
            <header className="home-main-categories-header">
              <h2 className="home-main-categories-title">Ana Kategoriler</h2>
              <p className="home-main-categories-subtitle">İhtiyacınıza uygun hizmetleri kolayca bulun</p>
            </header>
            
            <div className="main-categories-pills">
              {mainCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`main-category-pill ${selectedMainCategory === category ? "main-category-pill--active" : ""}`}
                  onClick={() => setSelectedMainCategory(category)}
                  aria-pressed={selectedMainCategory === category}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="home-main-categories-slider">
              <button
                type="button"
                className="categories-nav-btn categories-nav-btn--left"
                aria-label="Önceki kartlar"
                onClick={() => scrollCategoriesByDelta(-1)}
              >
                <img src="/images/left.svg" alt="Önceki" className="categories-nav-btn-icon" />
              </button>
              <div className="categories-scroller" ref={categoriesScrollerRef}>
                {serviceCards
                  .filter((card) => selectedMainCategory === "Tümü" || card.category === selectedMainCategory)
                  .map((card) => (
                    <div key={card.id} className="service-card">
                      <div className="service-card-image-wrapper">
                        <img
                          src={card.imageUrl}
                          alt={card.title}
                          className="service-card-image"
                        />
                      </div>
                      <div className="service-card-content">
                        <h3 className="service-card-title">{card.title}</h3>
                        <p className="service-card-categories">{card.subCategories.join(", ")}</p>
                        <div className="service-card-rating">
                          <span className="service-card-star">⭐</span>
                          <span className="service-card-rating-text">
                            {card.rating} ({card.reviewCount} Değerlendirme)
                          </span>
                        </div>
                        <div className="service-card-price">
                          {card.price.toLocaleString("tr-TR")}₺ / Ay
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <button
                type="button"
                className="categories-nav-btn categories-nav-btn--right"
                aria-label="Sonraki kartlar"
                onClick={() => scrollCategoriesByDelta(1)}
              >
                <img src="/images/right.svg" alt="Sonraki" className="categories-nav-btn-icon" />
              </button>
            </div>
          </section>

          <FeaturedInstitutions />

          <section>
            <div className="cta-section">
              <h3 className="cta-section-title">✨ Hayatın Merkezinde Olun!</h3>
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
      </main>
      </div>
    </div>
  );
}
