import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button, Card, CardContent } from "@/components/ui";
import { MapPin, GraduationCap, CheckCircle2, Star, Clock, Users, Mail, Phone, Globe, Calendar, Share2, BookOpen, Image as ImageIcon } from "lucide-react";
import "@/styles/pages/institution-detail.scss";
import ShareButton from "./ShareButton";

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
  },
  {
    id: 9,
    name: "Gelecek Spor Akademisi",
    location: "İSTANBUL, BEŞİKTAŞ",
    description: "Futbol ve basketbol alanlarında profesyonel eğitim veren modern spor tesisleri.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=300&fit=crop",
    slug: "gelecek-spor-akademisi",
    badge: {
      icon: "⚽",
      label: "Spor",
      color: "green"
    }
  },
  {
    id: 10,
    name: "Aqua Yüzme Kulübü",
    location: "İSTANBUL, KADIKÖY",
    description: "Modern havuz tesisleriyle her yaş grubuna yüzme eğitimi sunan profesyonel kulüp.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop",
    slug: "aqua-yuzme-kulubu",
    badge: {
      icon: "🏊",
      label: "Yüzme",
      color: "blue"
    }
  },
  {
    id: 11,
    name: "Raket Tenis Okulu",
    location: "ANKARA, ÇANKAYA",
    description: "Tenis sporunda uzmanlaşmış, uluslararası standartlarda kortlara sahip eğitim kurumu.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop",
    slug: "raket-tenis-okulu",
    badge: {
      icon: "🎾",
      label: "Tenis",
      color: "green"
    }
  },
  {
    id: 12,
    name: "Modern Sanat Atölyesi",
    location: "İZMİR, KONAK",
    description: "Resim ve heykel sanatlarında yaratıcılığı geliştiren, atölye çalışmaları sunan sanat merkezi.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    slug: "modern-sanat-atolyesi",
    badge: {
      icon: "🎨",
      label: "Sanat",
      color: "purple"
    }
  },
  {
    id: 13,
    name: "Dil Akademisi",
    location: "İSTANBUL, ŞİŞLİ",
    description: "İngilizce ve Almanca başta olmak üzere çok dilli eğitim programları sunan akademi.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop",
    slug: "dil-akademisi",
    badge: {
      icon: "🌍",
      label: "Yabancı Dil",
      color: "blue"
    }
  },
  {
    id: 14,
    name: "Müzik Okulu",
    location: "ANKARA, ÇANKAYA",
    description: "Piyano ve gitar eğitimi başta olmak üzere çeşitli enstrüman dersleri veren müzik okulu.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop",
    slug: "muzik-okulu",
    badge: {
      icon: "🎵",
      label: "Müzik",
      color: "purple"
    }
  },
  {
    id: 15,
    name: "Bale ve Dans Stüdyosu",
    location: "İSTANBUL, BEŞİKTAŞ",
    description: "Bale ve modern dans alanlarında profesyonel eğitim veren, sahne sanatlarına odaklanan stüdyo.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop",
    slug: "bale-ve-dans-studyosu",
    badge: {
      icon: "💃",
      label: "Dans",
      color: "purple"
    }
  },
  {
    id: 16,
    name: "Kodlama Akademisi",
    location: "İSTANBUL, KADIKÖY",
    description: "Web geliştirme ve mobil uygulama alanlarında güncel teknolojilerle eğitim veren akademi.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=300&fit=crop",
    slug: "kodlama-akademisi",
    badge: {
      icon: "💻",
      label: "Yazılım",
      color: "blue"
    }
  },
  {
    id: 17,
    name: "Kişisel Gelişim Merkezi",
    location: "ANKARA, ÇANKAYA",
    description: "Koçluk ve liderlik eğitimleriyle kişisel ve profesyonel gelişim destekleyen merkez.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    slug: "kisisel-gelisim-merkezi",
    badge: {
      icon: "✨",
      label: "Kişisel Gelişim",
      color: "purple"
    }
  },
  {
    id: 18,
    name: "Özel Okul",
    location: "İZMİR, KONAK",
    description: "İlkokul ve ortaokul seviyesinde kaliteli eğitim sunan, modern eğitim yaklaşımları benimseyen özel okul.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
    slug: "ozel-okul",
    badge: {
      icon: "🏫",
      label: "Okul",
      color: "blue"
    }
  },
  {
    id: 19,
    name: "Teknoloji Kursu",
    location: "İSTANBUL, ŞİŞLİ",
    description: "Robotik ve yapay zeka alanlarında geleceğin teknolojilerini öğreten, uygulamalı eğitim veren kurs.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop",
    slug: "teknoloji-kursu",
    badge: {
      icon: "🤖",
      label: "Teknoloji",
      color: "blue"
    }
  }
];

type InstitutionViewModel = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  logoUrl: string;
  slug: string;
  phone: string;
  website: string;
  address: string;
  workingHours: {
    weekdays: string;
    weekend: string;
  };
  about: string;
  categories: string[];
  isVerified: boolean;
  badge: {
    icon: string;
    label: string;
    color: string;
  };
  courses: Array<{
    id: string;
    title: string;
    category: string;
    price: string;
    duration: string;
    capacity: string;
    description: string;
    imageUrl: string;
  }>;
  gallery: string[];
  reviews: Array<{
    id: string;
    userName: string;
    initials: string;
    role: string;
    rating: number;
    comment: string;
  }>;
};

function adaptInstitution(institution: FeaturedInstitution): InstitutionViewModel {
  const locationParts = institution.location.split(", ");
  const city = locationParts[1] || locationParts[0];
  const district = locationParts[0] || "";

  const courses = [
    {
      id: `${institution.id}-1`,
      title: institution.name.includes("Dil") ? "İleri Seviye İngilizce (C1)" : "Python ile Veri Bilimi",
      category: institution.name.includes("Dil") ? "Yabancı Dil" : "Yazılım",
      price: institution.name.includes("Dil") ? "₺3.200" : "₺4.500",
      duration: institution.name.includes("Dil") ? "16 Hafta" : "12 Hafta",
      capacity: institution.name.includes("Dil") ? "12" : "20",
      description: institution.name.includes("Dil")
        ? "Akademik ve profesyonel hayatta akıcı İngilizce konuşma becerisi kazanın."
        : "Veri analizi, görselleştirme ve makine öğrenmesi temellerini öğrenin.",
      imageUrl: institution.name.includes("Dil")
        ? "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop"
        : "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop"
    },
    {
      id: `${institution.id}-2`,
      title: institution.name.includes("Dil") ? "Almanca Başlangıç (A1)" : "Web Geliştirme Temelleri",
      category: institution.name.includes("Dil") ? "Yabancı Dil" : "Yazılım",
      price: institution.name.includes("Dil") ? "₺2.800" : "₺3.900",
      duration: institution.name.includes("Dil") ? "14 Hafta" : "10 Hafta",
      capacity: institution.name.includes("Dil") ? "15" : "18",
      description: institution.name.includes("Dil")
        ? "Almanca dilinin temellerini öğrenerek günlük konuşmalara başlayın."
        : "HTML, CSS ve JavaScript ile modern web uygulamaları geliştirin.",
      imageUrl: institution.name.includes("Dil")
        ? "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop"
        : "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop"
    }
  ];

  const gallery = [
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop"
  ];

  const reviews = [
    {
      id: `${institution.id}-review-1`,
      userName: "Ahmet Yılmaz",
      initials: "AY",
      role: "Python Kursu Öğrencisi",
      rating: 5,
      comment: "Eğitmenler gerçekten çok ilgili ve konulara hakim. Sınıfların donanımı beklediğimden çok daha iyiydi. Kesinlikle tavsiye ederim."
    },
    {
      id: `${institution.id}-review-2`,
      userName: "Zeynep Kaya",
      initials: "ZK",
      role: "İngilizce C1 Öğrencisi",
      rating: 5,
      comment: "Kurs içeriği çok yoğun ama öğretici. Konum olarak çok merkezi olması büyük avantaj. Sadece kantin fiyatları biraz yüksek."
    }
  ];

  const categories: string[] = [];
  if (institution.badge.label.includes("Dil") || institution.name.includes("Dil")) {
    categories.push("Yabancı Dil");
  }
  if (institution.badge.label.includes("Yazılım") || institution.name.includes("Teknik")) {
    categories.push("Yazılım");
  }
  if (categories.length === 0) {
    categories.push(institution.badge.label);
  }

  return {
    ...institution,
    reviewCount: institution.id === 1 ? 120 : Math.floor(institution.rating * 25),
    logoUrl: institution.imageUrl,
    phone: "+90 (212) 555 01 23",
    website: `www.${institution.slug.replace(/-/g, "")}.com`,
    address: "Nisbetiye Mah. Gazi Güçnar Sok. No:4 Beşiktaş, İstanbul",
    workingHours: {
      weekdays: "Pzt - Cmt: 09:00 - 19:00",
      weekend: "Pazar: Kapalı"
    },
    about: `${institution.name}, 20 yılı aşkın tecrübesiyle öğrencilerine kaliteli ve çağdaş bir eğitim sunmaktadır. Uzman eğitmen kadromuz ve modern sınıflarımızla başarıya giden yolda yanınızdayız. Eğitim anlayışımız, sadece akademik başarıya değil, aynı zamanda bireysel gelişime de odaklanmaktadır.\n\nYenilikçi teknolojilerle donatılmış laboratuvarlarımız ve interaktif eğitim materyallerimizle, öğrencilerimize teorik bilgiyi pratiğe dökme imkanı sunuyoruz. Mezunlarımız, hem yerel hem de uluslararası platformlarda başarılara imza atmaktadır.`,
    categories,
    isVerified: true,
    courses,
    gallery,
    reviews
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const institution = featuredInstitutions.find((inst) => inst.slug === slug);

  if (!institution) {
    return {
      title: "Kurum Bulunamadı | Merkezden",
    };
  }

  return {
    title: `${institution.name} | Merkezden`,
    description: institution.description,
    openGraph: {
      title: `${institution.name} | Merkezden`,
      description: institution.description,
      images: institution.imageUrl ? [{ url: institution.imageUrl }] : [],
    },
  };
}

export default async function InstitutionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const institution = featuredInstitutions.find((inst) => inst.slug === slug);

  if (!institution) {
    notFound();
  }

  const viewModel = adaptInstitution(institution);

  return (
    <div className="institution-detail-page">
      <div className="institution-detail-container">
        <nav className="institution-breadcrumb" aria-label="Breadcrumb">
          <div className="institution-breadcrumb-container">
            <Link href="/" className="institution-breadcrumb-link">
              Ana Sayfa
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <Link href="/" className="institution-breadcrumb-link">
              Kurumlar
            </Link>
            <span className="institution-breadcrumb-separator"> &gt; </span>
            <span className="institution-breadcrumb-current">{viewModel.name}</span>
          </div>
        </nav>

        <Card className="institution-hero">
          <CardContent className="institution-hero-content">
            <div className="institution-hero-main">
              <div className="institution-logo-section">
                <div className="institution-logo-wrapper">
                  <Image
                    src={viewModel.logoUrl}
                    alt={viewModel.name}
                    width={160}
                    height={160}
                    className="institution-logo"
                  />
                </div>
              </div>
              <div className="institution-info">
                <div className="institution-title-row">
                  <h1 className="institution-name">{viewModel.name}</h1>
                  <div className="institution-rating-badge">
                    <Star className="institution-rating-icon" size={16} fill="currentColor" />
                    <span>{viewModel.rating}</span>
                    <span className="institution-rating-count">({viewModel.reviewCount}+ Değerlendirme)</span>
                  </div>
                </div>
                <p className="institution-description">{viewModel.description}</p>
                <div className="institution-meta">
                  <div className="institution-meta-item">
                    <MapPin size={18} />
                    <span>{viewModel.location}</span>
                  </div>
                  <div className="institution-meta-item">
                    <GraduationCap size={18} />
                    <span>{viewModel.categories.join(" & ")}</span>
                  </div>
                  {viewModel.isVerified && (
                    <div className="institution-meta-item institution-meta-verified">
                      <CheckCircle2 size={18} />
                      <span>Onaylı Kurum</span>
                    </div>
                  )}
                </div>
                <div className="institution-actions">
                  <ShareButton slug={viewModel.slug} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="institution-tabs-sticky">
          <div className="institution-tabs-list">
            <a href="#overview" className="institution-tab-item institution-tab-active">
              <BookOpen size={20} />
              <span>Genel Bakış</span>
            </a>
            <a href="#gallery" className="institution-tab-item">
              <ImageIcon size={20} />
              <span>Galeri</span>
            </a>
            <a href="#reviews" className="institution-tab-item">
              <Star size={20} />
              <span>Yorumlar</span>
            </a>
          </div>
        </div>

        <div className="institution-content-grid">
          <div className="institution-main-content">
            <section id="overview" className="institution-section">
              <h2 className="institution-section-title">Hakkımızda</h2>
              <Card className="institution-section-card">
                <CardContent>
                  <div className="institution-about-text">
                    {viewModel.about.split("\n\n").map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="gallery" className="institution-section">
              <h2 className="institution-section-title">Kurum Galerisi</h2>
              <div className="institution-gallery-grid">
                <div className="institution-gallery-item institution-gallery-main">
                  <Image
                    src={viewModel.gallery[0]}
                    alt="Kurum görseli"
                    fill
                    className="institution-gallery-image"
                    sizes="(max-width: 768px) 100vw, 66vw"
                  />
                </div>
                <div className="institution-gallery-item">
                  <Image
                    src={viewModel.gallery[1]}
                    alt="Kurum görseli"
                    fill
                    className="institution-gallery-image"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="institution-gallery-item">
                  <Image
                    src={viewModel.gallery[2]}
                    alt="Kurum görseli"
                    fill
                    className="institution-gallery-image"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
              </div>
            </section>

            <section id="reviews" className="institution-section">
              <div className="institution-section-header">
                <h2 className="institution-section-title">Öğrenci Yorumları</h2>
                <Button variant="default" size="sm" className="institution-review-button">
                  Yorum Yap
                </Button>
              </div>
              <div className="institution-reviews-list">
                {viewModel.reviews.map((review) => (
                  <Card key={review.id} className="institution-review-card">
                    <CardContent>
                      <div className="institution-review-header">
                        <div className="institution-review-user">
                          <div className="institution-review-avatar">
                            {review.initials}
                          </div>
                          <div>
                            <div className="institution-review-name">{review.userName}</div>
                            <div className="institution-review-role">{review.role}</div>
                          </div>
                        </div>
                        <div className="institution-review-stars">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={18}
                              className={i < review.rating ? "institution-star-filled" : "institution-star-empty"}
                              fill={i < review.rating ? "currentColor" : "none"}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="institution-review-comment">"{review.comment}"</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          <aside className="institution-sidebar">
            <div className="institution-sidebar-header">
              <Phone size={20} />
              <span>İletişim Bilgileri</span>
            </div>
            <div className="institution-sidebar-body">
              <div className="institution-map-preview">
                <Image
                  src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop"
                  alt="Harita"
                  fill
                  className="institution-map-image"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              </div>
              <div className="institution-contact-list">
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ADRES</div>
                    <div className="institution-contact-value">{viewModel.address}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">TELEFON</div>
                    <div className="institution-contact-value">{viewModel.phone}</div>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Globe size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">WEB SİTESİ</div>
                    <a href={`https://${viewModel.website}`} className="institution-contact-value institution-contact-link" target="_blank" rel="noopener noreferrer">
                      {viewModel.website}
                    </a>
                  </div>
                </div>
                <div className="institution-contact-item">
                  <div className="institution-contact-icon">
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="institution-contact-label">ÇALIŞMA SAATLERİ</div>
                    <div className="institution-contact-value">
                      <div>{viewModel.workingHours.weekdays}</div>
                      <div>{viewModel.workingHours.weekend}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
