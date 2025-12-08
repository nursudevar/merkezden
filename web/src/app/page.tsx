"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Separator, Slider, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Map, Search as SearchIcon, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import SearchBar from "@/components/SearchBar";
import HeroAnimation from "@/components/HeroAnimation";
import HeroSearchAnimation from "@/components/HeroSearchAnimation";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";

// Fix default icon paths for Leaflet in Next.js
const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Map component - client-side only (react-leaflet requires browser APIs)
function MapComponent() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="map-section-loading">
        Harita yükleniyor...
      </div>
    );
  }

  // Center to Ankara
  const center: [number, number] = [39.925533, 32.866287];

  return (
    <MapContainer center={center} zoom={10} className="full-size">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={center} icon={icon}>
        <Popup>Ankara</Popup>
      </Marker>
    </MapContainer>
  );
}

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

const featuredServices = [
  { title: "Montessori Anaokulu", icon: "🏫", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Kadıköy, İstanbul", rating: "4.9/5", reviews: 234 },
  { title: "LGS Hazırlık Kursu", icon: "📚", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Beşiktaş, İstanbul", rating: "4.8/5", reviews: 189 },
  { title: "Yüzme Kursu", icon: "⚽", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Şişli, İstanbul", rating: "4.7/5", reviews: 156 },
  { title: "Resim Atölyesi", icon: "🎨", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Üsküdar, İstanbul", rating: "4.9/5", reviews: 298 },
  { title: "İngilizce Kursu", icon: "🌍", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Konak, İzmir", rating: "4.6/5", reviews: 87 },
  { title: "Yaşam Koçluğu", icon: "✨", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Çankaya, Ankara", rating: "4.8/5", reviews: 145 },
  { title: "Muhasebe Kursu", icon: "🎯", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Bornova, İzmir", rating: "4.7/5", reviews: 203 },
  { title: "Oyun Terapisi", icon: "🧩", iconClassName: "featured-service-card-icon-section", buttonClassName: "featured-service-card-button", location: "Maltepe, İstanbul", rating: "4.9/5", reviews: 167 },
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
  { icon: "🏫", title: "Çocuğunuz İçin Doğru Okul Nasıl Seçilir?", description: "Okul seçimi yaparken dikkat edilmesi gereken kriterler, eğitim kalitesi ve çocuğunuzun gelişimi için önemli faktörler...", date: "15 Aralık 2024", views: "1.2K", className: "blog-card" },
  { icon: "📚", title: "LGS'ye Hazırlık: Başarı İçin 10 Altın Kural", description: "LGS sınavına etkili hazırlık stratejileri, zaman yönetimi ve motivasyon teknikleri ile başarıya giden yol...", date: "12 Aralık 2024", views: "2.8K", className: "blog-card" },
  { icon: "⚽", title: "Çocuklarda Spor Alışkanlığı Nasıl Kazandırılır?", description: "Çocuğunuzun yaşına uygun spor dalları, fiziksel gelişim ve sosyal beceriler için sporun önemi...", date: "10 Aralık 2024", views: "1.5K", className: "blog-card" },
  { icon: "🎨", title: "Sanatın Çocuk Gelişimine Etkisi", description: "Resim, müzik ve dans gibi sanat dallarının çocukların yaratıcılık, motor beceri ve duygusal gelişimine katkıları...", date: "8 Aralık 2024", views: "980", className: "blog-card" },
  { icon: "🌍", title: "Yabancı Dil Öğrenmenin En Etkili Yolları", description: "Dil öğrenme sürecini hızlandıran teknikler, pratik yapma yöntemleri ve motivasyonu yüksek tutma stratejileri...", date: "5 Aralık 2024", views: "2.1K", className: "blog-card" },
  { icon: "✨", title: "Etkili İletişim Becerileri Geliştirme", description: "Günlük hayatta ve iş yaşamında başarılı iletişim kurma teknikleri, empati ve aktif dinleme becerileri...", date: "3 Aralık 2024", views: "1.7K", className: "blog-card" },
  { icon: "🎯", title: "Dijital Çağda Mesleki Beceriler", description: "Teknoloji ile birlikte değişen iş dünyasında öne çıkan mesleki beceriler ve kariyer planlama stratejileri...", date: "1 Aralık 2024", views: "1.4K", className: "blog-card" },
  { icon: "🧩", title: "Özel Gereksinimli Çocuklar İçin Eğitim", description: "Özel eğitim sürecinde aile desteği, terapi yöntemleri ve çocuğunuzun potansiyelini ortaya çıkarma teknikleri...", date: "28 Kasım 2024", views: "890", className: "blog-card" },
  { icon: "🐾", title: "Evcil Hayvan Bakımında Dikkat Edilecekler", description: "Köpek ve kedi bakımında temel kurallar, beslenme, sağlık kontrolü ve eğitim süreçleri hakkında bilgiler...", date: "25 Kasım 2024", views: "1.1K", className: "blog-card" },
];

function FilterIndicator() {
  return <span className="filter-indicator" />;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [priceRange, setPriceRange] = useState<number[]>([0, 10000]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<Set<string>>(new Set());
  const [expandedCategoryCards, setExpandedCategoryCards] = useState<Record<string, boolean>>({});
  const [categoriesScrollProgress, setCategoriesScrollProgress] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(250);
  const categoriesScrollerRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {""
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
    const scroller = categoriesScrollerRef.current;
    if (!scroller) return;

    const updateScrollProgress = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scroller;
      const maxScroll = scrollWidth - clientWidth;
      // If there's no scroll (single page), show 100% or hide the bar
      const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 100;
      setCategoriesScrollProgress(progress);
    };

    updateScrollProgress();
    scroller.addEventListener("scroll", updateScrollProgress);
    window.addEventListener("resize", updateScrollProgress);

    return () => {
      scroller.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  useEffect(() => {
    const track = progressTrackRef.current;
    if (!track) return;

    const updateTrackWidth = () => {
      setTrackWidth(track.offsetWidth);
      
      // Calculate indicator width based on screen size
      const screenWidth = window.innerWidth;
      if (screenWidth <= 480) {
        setIndicatorWidth(100);
      } else if (screenWidth <= 640) {
        setIndicatorWidth(120);
      } else if (screenWidth <= 768) {
        setIndicatorWidth(160);
      } else if (screenWidth <= 1024) {
        setIndicatorWidth(200);
      } else {
        setIndicatorWidth(250);
      }
    };

    updateTrackWidth();
    window.addEventListener("resize", updateTrackWidth);

    return () => {
      window.removeEventListener("resize", updateTrackWidth);
    };
  }, []);

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
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
          <div className="header-search">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Örnek: Kadıköy'de çocuğum için yüzme kursu arıyorum"
              buttonText="ARA"
            />
          </div>
          <div className="header-actions">
            <Link href="/login">
              <Button className="button-primary" variant="default">
                GİRİŞ YAP
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-search">
        <div className="hero-search-container">
          <HeroSearchAnimation />
        </div>
      </section>

      <div className="main-layout">
        <aside className="filter-sidebar">
          <Card className="filter-sidebar-card">
            <CardHeader className="filter-sidebar-header">
              <div className="filter-sidebar-header-content">
                <span className="filter-sidebar-header-icon">🔎</span>
                <CardTitle className="filter-sidebar-header-title">Filtreler</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="filter-sidebar-content">
              <div className="map-section">
                <div className="map-section-overlay">
                  <Map className="icon-sm" />
                  Haritada Ara
                </div>
                <div className="map-section-container">
                  <MapComponent />
                </div>
                <Button className="map-section-button">
                  <MapPin className="icon-sm" />
                  Haritada Göster
                </Button>
              </div>

              <div className="filter-section">
                <div className="filter-section-title">
                  <span>🔍</span>
                  <span>Aranacak Kelime</span>
                </div>
                <div className="search-input-wrapper">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Hizmet adı, kategori..."
                    className="search-input-wrapper-input"
                  />
                  <Button className="search-input-wrapper-button">
                    <SearchIcon className="icon-md" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="filter-section">
                <div className="filter-section-title">
                  <span>📍</span>
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
                  <span>💰</span>
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
                  <span>🎯</span>
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
                <Accordion type="multiple" defaultValue={categoryGroups.map((group) => group.id)}>
                  {categoryGroups.map((group) => {
                    const isExpanded = expandedCategories.includes(group.id);
                    const hasMore = group.items.length > 4;
                    const itemsToShow = isExpanded ? group.items : group.items.slice(0, hasMore ? 4 : group.items.length);
                    const categoryClassMap: Record<string, string> = {
                      school: "school",
                      exam: "course",
                      sport: "sport",
                      art: "art",
                      language: "language",
                      "personal-dev": "personal",
                      professional: "vocational",
                      special: "special",
                      pets: "pet",
                    };
                    const categoryClass = categoryClassMap[group.id] || "";

                    return (
                      <AccordionItem key={group.id} value={group.id} className="category-accordion-item">
                        <div className={`category-accordion-header-wrapper ${categoryClass}`}>
                          <AccordionTrigger className="category-accordion-trigger">
                            <FilterIndicator />
                            <span>{group.icon}</span>
                            <span>{group.title}</span>
                          </AccordionTrigger>
                        </div>
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
              <h2 className="home-main-categories-title">🏠 Ana Kategoriler</h2>
              <p className="home-main-categories-subtitle">İhtiyacınız olan hizmeti seçin</p>
            </header>
            <div className="home-main-categories-slider">
              <button
                type="button"
                className="categories-nav-btn categories-nav-btn--left"
                aria-label="Önceki kategoriler"
                onClick={() => scrollCategoriesByDelta(-1)}
              >
                ‹
              </button>
              <div className="categories-scroller" ref={categoriesScrollerRef}>
                {categories.slice(0, 8).map((category) => {
                  const isExpanded = expandedCategoryCards[category.name] || false;
                  const visibleItems = isExpanded ? category.items : category.items.slice(0, 3);
                  const hasMoreItems = category.items.length > 3;

                  const toggleExpanded = () => {
                    setExpandedCategoryCards((prev) => ({
                      ...prev,
                      [category.name]: !prev[category.name],
                    }));
                  };

                  return (
                    <Card key={category.name} className={category.className}>
                      <CardContent className="category-card-content">
                        <div className="category-card-icon">
                          <span>{category.icon}</span>
                        </div>
                        <CardTitle className="category-card-title">{category.name}</CardTitle>
                        <div className="category-card-items">
                          <div className="category-card-items-list">
                            {visibleItems.map((item) => (
                              <div key={item} className="category-card-item">
                                {item}
                              </div>
                            ))}
                          </div>
                          {hasMoreItems && (
                            <button
                              type="button"
                              className="category-card-more"
                              onClick={toggleExpanded}
                              aria-label={isExpanded ? "Daha az göster" : "Daha fazla göster"}
                            >
                              {isExpanded ? "Daha az göster" : "Daha fazla göster"}
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <button
                type="button"
                className="categories-nav-btn categories-nav-btn--right"
                aria-label="Sonraki kategoriler"
                onClick={() => scrollCategoriesByDelta(1)}
              >
                ›
              </button>
            </div>
            <div className="categories-progress-bar">
              <div className="categories-progress-track" ref={progressTrackRef}>
                <div
                  className="categories-progress-indicator"
                  style={{
                    width: `${indicatorWidth}px`,
                    transform: `translateX(${trackWidth > indicatorWidth ? (categoriesScrollProgress / 100) * (trackWidth - indicatorWidth) : 0}px)`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2 className="section-title">⭐ Öne Çıkanlar</h2>
              <p className="section-subtitle">Her kategoriden seçkin hizmetler</p>
            </div>
            <div className="featured-section-grid">
              {featuredServices.map((service) => (
                <Card key={service.title} className="featured-service-card">
                  <div className={service.iconClassName}>
                    <span>{service.icon}</span>
                  </div>
                  <CardContent className="featured-service-card-content">
                    <h3 className="featured-service-card-title">{service.title}</h3>
                    <div className="featured-service-card-location">
                      <span>📍</span>
                      <span>{service.location}</span>
                    </div>
                    <div className="featured-service-card-rating">
                      <span>⭐</span>
                      <span>{service.rating} ({service.reviews} değerlendirme)</span>
                    </div>
                    <Button className={service.buttonClassName}>
                      İletişime Geç
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

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
              <h2 className="blog-section-title">📝 Blog Yazıları</h2>
              <p className="blog-section-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
            </div>
            <div className="blog-section-grid">
              {blogPosts.map((post, index) => (
                <Card key={index} className={post.className}>
                  <CardContent className="blog-card-content">
                    <div className="blog-card-icon">
                      <span>{post.icon}</span>
                    </div>
                    <h3 className="blog-card-title">{post.title}</h3>
                    <p className="blog-card-description">{post.description}</p>
                    <div className="blog-card-footer">
                      <span className="blog-card-meta">
                        <span>🗓️</span>
                        <span>{post.date}</span>
                      </span>
                      <span className="blog-card-meta">
                        <span>👁️</span>
                        <span>{post.views} görüntülenme</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="blog-section-button-wrapper">
              <button className="blog-section-button">
                Tüm Blog Yazılarını Gör
              </button>
            </div>
          </section>
      </main>
      </div>
    </div>
  );
}
