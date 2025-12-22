"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import FeaturedPost from "@/components/blog/FeaturedPost";
import CategoryTabs from "@/components/blog/CategoryTabs";
import ViewToggle from "@/components/blog/ViewToggle";
import PostGrid from "@/components/blog/PostGrid";
import PostList from "@/components/blog/PostList";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";

type BlogPost = {
  title: string;
  excerpt: string;
  imageUrl: string;
  slug: string;
  category: string;
  author?: string;
  date?: string;
  featured?: boolean;
};

const allBlogPosts: BlogPost[] = [
  {
    title: "Etkili Zaman Yönetimi İçin 5 İpucu",
    excerpt: "Günlük verimliliğinizi artırmak ve hedeflerinize daha hızlı ulaşmak için bu teknikleri uygulayın.",
    imageUrl: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=450&fit=crop",
    slug: "etkili-zaman-yonetimi-ipuclari",
    category: "Kişisel Gelişim",
    author: "Ahmet Demir",
    date: "10 EKİM 2023",
    featured: true,
  },
  {
    title: "Liderlik Becerilerinizi Nasıl Geliştirirsiniz?",
    excerpt: "İyi bir lider olmak doğuştan gelen bir yetenek değil, öğrenilebilen bir beceridir. İşte başlangıç noktaları.",
    imageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=450&fit=crop",
    slug: "liderlik-becerileri-gelistirme",
    category: "Kariyer",
    author: "Mehmet Kaya",
    date: "08 EKİM 2023",
  },
  {
    title: "Çocuğunuz İçin Doğru Okul Nasıl Seçilir?",
    excerpt: "Okul seçimi yaparken dikkat edilmesi gereken kriterler, eğitim kalitesi ve çocuğunuzun gelişimi için önemli faktörler...",
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=450&fit=crop",
    slug: "dogru-okul-secimi",
    category: "Okul",
    author: "Ayşe Yılmaz",
    date: "05 EKİM 2023",
  },
  {
    title: "LGS'ye Hazırlık: Başarı İçin 10 Altın Kural",
    excerpt: "LGS sınavına etkili hazırlık stratejileri, zaman yönetimi ve motivasyon teknikleri ile başarıya giden yol...",
    imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=450&fit=crop",
    slug: "lgs-hazirlik-altin-kurallar",
    category: "Kurs & Sınav",
    author: "Caner Erkin",
    date: "01 EKİM 2023",
  },
  {
    title: "Çocuklarda Spor Alışkanlığı Nasıl Kazandırılır?",
    excerpt: "Çocuğunuzun yaşına uygun spor dalları, fiziksel gelişim ve sosyal beceriler için sporun önemi...",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop",
    slug: "cocuklarda-spor-aliskanligi",
    category: "Spor",
    author: "Elif Şafak",
    date: "28 EYLÜL 2023",
  },
  {
    title: "Sanatın Çocuk Gelişimine Etkisi",
    excerpt: "Resim, müzik ve dans gibi sanat dallarının çocukların yaratıcılık, motor beceri ve duygusal gelişimine katkıları...",
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=450&fit=crop",
    slug: "sanatin-cocuk-gelisimine-etkisi",
    category: "Sanat",
    author: "Murat Boz",
    date: "25 EYLÜL 2023",
  },
  {
    title: "Yabancı Dil Öğrenmenin En Etkili Yolları",
    excerpt: "Dil öğrenme sürecini hızlandıran teknikler, pratik yapma yöntemleri ve motivasyonu yüksek tutma stratejileri...",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=450&fit=crop",
    slug: "yabanci-dil-ogrenme-yollari",
    category: "Yabancı Dil",
    author: "Zeynep Yılmaz",
    date: "12 EKİM 2023",
  },
  {
    title: "Etkili İletişim Becerileri Geliştirme",
    excerpt: "Günlük hayatta ve iş yaşamında başarılı iletişim kurma teknikleri, empati ve aktif dinleme becerileri...",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop",
    slug: "etkili-iletisim-becerileri",
    category: "Kişisel Gelişim",
    author: "Ahmet Demir",
    date: "10 EKİM 2023",
  },
  {
    title: "Dijital Çağda Mesleki Beceriler",
    excerpt: "Teknoloji ile birlikte değişen iş dünyasında öne çıkan mesleki beceriler ve kariyer planlama stratejileri...",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
    slug: "dijital-cagda-mesleki-beceriler",
    category: "Kariyer",
    author: "Mehmet Kaya",
    date: "08 EKİM 2023",
  },
];

const allCategories = ["Hepsi", ...Array.from(new Set(allBlogPosts.map((post) => post.category)))];

export default function BlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>("Hepsi");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Initialize from URL params
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    const viewParam = searchParams.get("view");

    if (categoryParam && allCategories.includes(categoryParam)) {
      setSelectedCategory(categoryParam);
    }

    if (viewParam === "list" || viewParam === "grid") {
      setViewMode(viewParam);
    } else {
      // Try to get from localStorage
      const savedView = localStorage.getItem("blogViewMode");
      if (savedView === "list" || savedView === "grid") {
        setViewMode(savedView);
      }
    }
  }, [searchParams]);

  // Update URL when category or view changes
  const updateURL = (category: string, view: "grid" | "list") => {
    const params = new URLSearchParams();
    if (category !== "Hepsi") {
      params.set("category", category);
    }
    if (view !== "grid") {
      params.set("view", view);
    }
    const queryString = params.toString();
    router.push(queryString ? `/blog?${queryString}` : "/blog", { scroll: false });
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    updateURL(category, viewMode);
  };

  const handleViewChange = (view: "grid" | "list") => {
    setViewMode(view);
    localStorage.setItem("blogViewMode", view);
    updateURL(selectedCategory, view);
  };

  // Filter posts based on selected category
  const filteredPosts = useMemo(() => {
    if (selectedCategory === "Hepsi") {
      return allBlogPosts;
    }
    return allBlogPosts.filter((post) => post.category === selectedCategory);
  }, [selectedCategory]);

  // Get featured post (first featured post in filtered results, or first post if none featured)
  const featuredPost = useMemo(() => {
    const featured = filteredPosts.find((post) => post.featured);
    return featured || filteredPosts[0];
  }, [filteredPosts]);

  // Get remaining posts (excluding featured)
  const remainingPosts = useMemo(() => {
    if (!featuredPost) return filteredPosts;
    return filteredPosts.filter((post) => post.slug !== featuredPost.slug);
  }, [filteredPosts, featuredPost]);

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
          <div className="header-actions">
            <Link href="/login">
              <Button className="button-primary" variant="default">
                GİRİŞ YAP
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="blog-listing-page">
          <div className="blog-listing-header">
            <h1 className="blog-listing-title">Blog Yazıları</h1>
            <p className="blog-listing-subtitle">
              Öğretmenler, öğrenciler ve eğitimciler için en güncel trendler, pedagojik ipuçları ve detaylı analizler.
            </p>
          </div>

          <CategoryTabs
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />

          {featuredPost && (
            <div className="blog-featured-section">
              <FeaturedPost
                title={featuredPost.title}
                excerpt={featuredPost.excerpt}
                imageUrl={featuredPost.imageUrl}
                slug={featuredPost.slug}
                category={featuredPost.category}
                author={featuredPost.author}
                date={featuredPost.date}
              />
            </div>
          )}

          <div className="blog-posts-section">
            <div className="blog-posts-section-header">
              <h2 className="blog-posts-section-title">Son Yazılar</h2>
              <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            </div>

            {viewMode === "grid" ? (
              <PostGrid posts={remainingPosts} />
            ) : (
              <PostList posts={remainingPosts} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
