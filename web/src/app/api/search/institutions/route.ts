import { NextResponse } from "next/server";
import { matchesSearch } from "@/lib/utils/search";

// Import institution data - in production, this would come from Supabase
// For now, using the same mock data structure from homepage
type Institution = {
  id: number;
  name: string;
  location: string;
  description: string;
  rating: number;
  imageUrl: string;
  slug: string;
  badge?: {
    icon: string;
    label: string;
    color: string;
  };
};

// Mock institutions data - matches featuredInstitutions from homepage
const allInstitutions: Institution[] = [
  {
    id: 1,
    name: "Boğaziçi Koleji",
    location: "İSTANBUL, BEŞİKTAŞ",
    description: "Global vizyonu ve modern eğitim kampüsü ile geleceğin liderlerini yetiştiren prestijli bir kurum.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
    slug: "bogazici-koleji",
    badge: { icon: "✓", label: "%25 Burs", color: "purple" }
  },
  {
    id: 2,
    name: "Ankara Bilim Lisesi",
    location: "ANKARA, ÇANKAYA",
    description: "Teknoloji ve bilim odaklı müfredatıyla fark yaratan bir eğitim kurumu.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    slug: "ankara-bilim-lisesi",
    badge: { icon: "🎓", label: "Fen Lisesi", color: "blue" }
  },
  {
    id: 3,
    name: "Ege Çağdaş Koleji",
    location: "İZMİR, KONAK",
    description: "Sanat ve spor aktiviteleriyle zenginleştirilmiş, bütünsel gelişim odaklı eğitim anlayışı.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop",
    slug: "ege-cagdas-koleji",
    badge: { icon: "🌿", label: "Yeşil Kampüs", color: "green" }
  },
  {
    id: 4,
    name: "Nilüfer Akademi",
    location: "BURSA, NİLÜFER",
    description: "Uluslararası standartlarda yabancı dil eğitimi ve yurt dışı eğitim fırsatları sunan kurum.",
    rating: 5.0,
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
    slug: "nilufer-akademi",
    badge: { icon: "🌍", label: "Çift Dil", color: "purple" }
  },
  {
    id: 5,
    name: "İstanbul Teknik Koleji",
    location: "İSTANBUL, KADIKÖY",
    description: "Mühendislik ve teknoloji alanında uzmanlaşmış, çağdaş eğitim yaklaşımıyla öne çıkan kurum.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
    slug: "istanbul-teknik-koleji",
    badge: { icon: "🔧", label: "Teknik", color: "blue" }
  },
  {
    id: 6,
    name: "Ankara Yabancı Dil Koleji",
    location: "ANKARA, ÇANKAYA",
    description: "Çok dilli eğitim programı ve uluslararası değişim fırsatlarıyla öğrencilerine global vizyon kazandıran kurum.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop",
    slug: "ankara-yabanci-dil-koleji",
    badge: { icon: "🗣️", label: "Çok Dilli", color: "blue" }
  },
  {
    id: 7,
    name: "İzmir Spor Akademisi",
    location: "İZMİR, KARŞIYAKA",
    description: "Profesyonel sporcu yetiştirme programları ve modern spor tesisleriyle öne çıkan kurum.",
    rating: 4.5,
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop",
    slug: "izmir-spor-akademisi",
    badge: { icon: "⚽", label: "Spor", color: "green" }
  },
  {
    id: 8,
    name: "Bursa Sanat Okulu",
    location: "BURSA, OSMANGAZİ",
    description: "Resim, müzik ve tiyatro alanlarında kapsamlı eğitim programları sunan sanat odaklı kurum.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=400&fit=crop",
    slug: "bursa-sanat-okulu",
    badge: { icon: "🎨", label: "Sanat", color: "purple" }
  },
  {
    id: 9,
    name: "Antalya Özel Okul",
    location: "ANTALYA, MURATPAŞA",
    description: "Akademik başarı ve karakter gelişimini birleştiren, öğrenci odaklı eğitim yaklaşımı.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop",
    slug: "antalya-ozel-okul",
    badge: { icon: "⭐", label: "Özel", color: "blue" }
  },
  {
    id: 10,
    name: "Kocaeli Meslek Lisesi",
    location: "KOCAELİ, İZMİT",
    description: "Endüstriyel ve teknik alanlarda uygulamalı eğitim veren, iş dünyasıyla entegre kurum.",
    rating: 4.4,
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop",
    slug: "kocaeli-meslek-lisesi",
    badge: { icon: "🔩", label: "Meslek", color: "orange" }
  },
  // Service cards from homepage
  {
    id: 101,
    name: "Gelecek Spor Akademisi",
    location: "ANKARA, ÇANKAYA",
    description: "Futbol ve basketbol alanlarında profesyonel eğitim veren spor akademisi.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=400&fit=crop",
    slug: "gelecek-spor-akademisi",
    badge: { icon: "⚽", label: "Spor", color: "green" }
  },
  {
    id: 102,
    name: "Aqua Yüzme Kulübü",
    location: "ANKARA, ÇANKAYA",
    description: "Profesyonel yüzme eğitimi ve yarışma hazırlığı sunan kulüp.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&h=400&fit=crop",
    slug: "aqua-yuzme-kulubu",
    badge: { icon: "🏊", label: "Yüzme", color: "blue" }
  },
  {
    id: 103,
    name: "Raket Tenis Okulu",
    location: "ANKARA, ÇANKAYA",
    description: "Tenis eğitimi ve turnuva hazırlığı programları.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=600&h=400&fit=crop",
    slug: "raket-tenis-okulu",
    badge: { icon: "🎾", label: "Tenis", color: "green" }
  },
  {
    id: 104,
    name: "Modern Sanat Atölyesi",
    location: "ANKARA, ÇANKAYA",
    description: "Resim ve heykel alanlarında sanat eğitimi.",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&h=400&fit=crop",
    slug: "modern-sanat-atolyesi",
    badge: { icon: "🎨", label: "Sanat", color: "purple" }
  },
  {
    id: 105,
    name: "Dil Akademisi",
    location: "ANKARA, ÇANKAYA",
    description: "İngilizce ve Almanca dil eğitimi programları.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop",
    slug: "dil-akademisi",
    badge: { icon: "🗣️", label: "Dil", color: "blue" }
  },
  {
    id: 106,
    name: "Müzik Okulu",
    location: "ANKARA, ÇANKAYA",
    description: "Piyano ve gitar eğitimi veren müzik okulu.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=400&fit=crop",
    slug: "muzik-okulu",
    badge: { icon: "🎵", label: "Müzik", color: "purple" }
  },
  {
    id: 107,
    name: "Bale ve Dans Stüdyosu",
    location: "ANKARA, ÇANKAYA",
    description: "Bale ve modern dans eğitimi programları.",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop",
    slug: "bale-ve-dans-studyosu",
    badge: { icon: "💃", label: "Dans", color: "pink" }
  },
  {
    id: 108,
    name: "Kodlama Akademisi",
    location: "ANKARA, ÇANKAYA",
    description: "Web geliştirme ve mobil uygulama eğitimi.",
    rating: 4.9,
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop",
    slug: "kodlama-akademisi",
    badge: { icon: "💻", label: "Yazılım", color: "blue" }
  },
  {
    id: 109,
    name: "Kişisel Gelişim Merkezi",
    location: "ANKARA, ÇANKAYA",
    description: "Koçluk ve liderlik eğitim programları.",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
    slug: "kisisel-gelisim-merkezi",
    badge: { icon: "🌟", label: "Kişisel Gelişim", color: "purple" }
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    // Minimum character check
    if (query.length < 1) {
      return NextResponse.json({ results: [], message: "En az 1 karakter giriniz" });
    }

    // Search in name, location, and description
    const results = allInstitutions
      .filter((institution) => {
        return (
          matchesSearch(institution.name, query) ||
          matchesSearch(institution.location, query) ||
          matchesSearch(institution.description, query)
        );
      })
      .slice(0, 20) // Limit to 20 results
      .map((institution) => ({
        id: institution.id.toString(),
        name: institution.name,
        description: institution.description,
        location: institution.location,
        rating: institution.rating,
        reviewCount: Math.floor(institution.rating * 25), // Mock review count
        imageUrl: institution.imageUrl,
        slug: institution.slug,
        badge: institution.badge || null,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Search API] Error:", error);
    return NextResponse.json(
      { results: [], error: "Arama sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
