"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import BlogCard from "@/components/BlogCard";
import "@/styles/main.scss";
import "@/styles/pages/home.scss";
import "@/styles/pages/blog.scss";

const allBlogPosts = [
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
  {
    title: "Yabancı Dil Öğrenmenin En Etkili Yolları",
    excerpt: "Dil öğrenme sürecini hızlandıran teknikler, pratik yapma yöntemleri ve motivasyonu yüksek tutma stratejileri...",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=450&fit=crop",
    slug: "yabanci-dil-ogrenme-yollari",
  },
  {
    title: "Etkili İletişim Becerileri Geliştirme",
    excerpt: "Günlük hayatta ve iş yaşamında başarılı iletişim kurma teknikleri, empati ve aktif dinleme becerileri...",
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop",
    slug: "etkili-iletisim-becerileri",
  },
  {
    title: "Dijital Çağda Mesleki Beceriler",
    excerpt: "Teknoloji ile birlikte değişen iş dünyasında öne çıkan mesleki beceriler ve kariyer planlama stratejileri...",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
    slug: "dijital-cagda-mesleki-beceriler",
  },
];

export default function BlogPage() {
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
            <h1 className="blog-listing-title">📝 Blog Yazıları</h1>
            <p className="blog-listing-subtitle">Uzmanlardan öneriler ve faydalı bilgiler</p>
          </div>

          <div className="blog-listing-grid">
            {allBlogPosts.map((post, index) => (
              <BlogCard
                key={index}
                title={post.title}
                excerpt={post.excerpt}
                imageUrl={post.imageUrl}
                slug={post.slug}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

