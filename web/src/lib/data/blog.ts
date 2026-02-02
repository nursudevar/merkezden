export type ContentBlock = 
  | { type: 'paragraph'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string; author?: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  authorName: string;
  coverImage: string;
  featured?: boolean;
  content: ContentBlock[];
};

export const allBlogPosts: BlogPost[] = [
  {
    slug: "etkili-zaman-yonetimi-ipuclari",
    title: "Etkili Zaman Yönetimi İçin 5 İpucu",
    excerpt: "Günlük verimliliğinizi artırmak ve hedeflerinize daha hızlı ulaşmak için bu teknikleri uygulayın.",
    category: "Kişisel Gelişim",
    date: "10 EKİM 2023",
    authorName: "Ahmet Demir",
    coverImage: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=450&fit=crop",
    featured: true,
    content: [
      { type: 'paragraph', text: 'Zaman yönetimi, modern hayatın en önemli becerilerinden biridir. Günlük hayatımızda iş, aile, sosyal aktiviteler ve kişisel gelişim arasında denge kurmak zorundayız. Bu yazıda, verimliliğinizi artıracak ve hedeflerinize daha hızlı ulaşmanızı sağlayacak 5 pratik ipucu paylaşacağız.' },
      { type: 'h2', text: '1. Önceliklendirme Yapın' },
      { type: 'paragraph', text: 'Her gün yapılacaklar listenizi oluştururken, görevleri önem ve aciliyet durumuna göre sıralayın. Eisenhower Matrisi gibi kanıtlanmış yöntemler kullanarak görevlerinizi kategorize edebilirsiniz:' },
      { type: 'list', items: [
        'Acil ve önemli: Hemen yapılmalı',
        'Önemli ama acil değil: Planlanmalı',
        'Acil ama önemli değil: Başkasına devredilmeli',
        'Ne acil ne önemli: İptal edilmeli'
      ]},
      { type: 'h2', text: '2. Pomodoro Tekniğini Kullanın' },
      { type: 'paragraph', text: 'Pomodoro Tekniği, 25 dakikalık odaklanma seansları ve 5 dakikalık molalar içerir. Bu yöntem, dikkat sürenizi artırır ve yorgunluğu azaltır. Her 4 Pomodoro\'dan sonra daha uzun bir mola (15-30 dakika) alın.' },
      { type: 'h3', text: 'Nasıl Uygulanır?' },
      { type: 'list', items: [
        '25 dakika boyunca sadece bir göreve odaklanın',
        'Zamanlayıcı kullanın ve dikkat dağıtıcıları kaldırın',
        '5 dakika mola verin',
        '4 seans sonrası 15-30 dakika uzun mola'
      ]},
      { type: 'h2', text: '3. "Hayır" Demeyi Öğrenin' },
      { type: 'paragraph', text: 'Zamanınızı korumak için gerektiğinde "hayır" demekten çekinmeyin. Her yeni görev veya sorumluluk, mevcut planınızı etkiler. Önceliklerinize uymayan talepleri nazikçe reddetmek, zaman yönetimi için kritiktir.' },
      { type: 'h2', text: '4. Teknolojiyi Akıllıca Kullanın' },
      { type: 'paragraph', text: 'Zaman yönetimi uygulamaları, takvim araçları ve görev yönetim sistemleri günlük rutininizi optimize edebilir. Ancak teknoloji aynı zamanda dikkat dağıtıcı da olabilir. Bildirimleri kapatın ve belirli saatlerde e-posta ve sosyal medyayı kontrol edin.' },
      { type: 'h2', text: '5. Düzenli Değerlendirme Yapın' },
      { type: 'paragraph', text: 'Haftalık olarak zamanınızı nasıl harcadığınızı gözden geçirin. Hangi aktiviteler size en çok değer katıyor? Hangi görevler zaman kaybına neden oluyor? Bu değerlendirme, gelecek haftalar için daha iyi planlama yapmanıza yardımcı olacaktır.' },
      { type: 'quote', text: 'Zamanınızı yönetmek, hayatınızı yönetmektir. Küçük değişiklikler büyük farklar yaratır.', author: 'Ahmet Demir' },
      { type: 'paragraph', text: 'Bu ipuçlarını günlük rutininize entegre ederek zaman yönetimi becerilerinizi geliştirebilir ve daha verimli bir yaşam sürebilirsiniz. Unutmayın, mükemmellik bir gecede gelmez - sabır ve tutarlılık anahtardır.' }
    ]
  },
  {
    slug: "liderlik-becerileri-gelistirme",
    title: "Liderlik Becerilerinizi Nasıl Geliştirirsiniz?",
    excerpt: "İyi bir lider olmak doğuştan gelen bir yetenek değil, öğrenilebilen bir beceridir. İşte başlangıç noktaları.",
    category: "Kariyer",
    date: "08 EKİM 2023",
    authorName: "Mehmet Kaya",
    coverImage: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Liderlik, sadece bir pozisyon değil, aynı zamanda bir beceridir. İyi haber şu ki, liderlik becerileri öğrenilebilir ve geliştirilebilir. Bu yazıda, etkili bir lider olmak için gerekli temel becerileri ve bunları nasıl geliştirebileceğinizi keşfedeceğiz.' },
      { type: 'h2', text: 'İletişim Becerileri' },
      { type: 'paragraph', text: 'Etkili liderlik, açık ve net iletişimle başlar. Takımınızla düzenli olarak iletişim kurun, geri bildirim alın ve verin. Aktif dinleme, empati ve açık sözlülük liderlik için kritik özelliklerdir.' },
      { type: 'h2', text: 'Vizyon ve Strateji' },
      { type: 'paragraph', text: 'İyi bir lider, net bir vizyona sahiptir ve bu vizyonu takımıyla paylaşır. Uzun vadeli hedefler belirleyin ve bunlara ulaşmak için adım adım stratejiler geliştirin.' },
      { type: 'h2', text: 'Karar Verme' },
      { type: 'paragraph', text: 'Liderler sık sık zor kararlar almak zorundadır. Veriye dayalı kararlar alın, riskleri değerlendirin ve sonuçların sorumluluğunu üstlenin.' },
      { type: 'h2', text: 'Takım Geliştirme' },
      { type: 'paragraph', text: 'Güçlü bir takım oluşturmak, liderliğin temel taşlarından biridir. Takım üyelerinizin güçlü yönlerini tanıyın, onları destekleyin ve gelişimlerine yatırım yapın.' }
    ]
  },
  {
    slug: "dogru-okul-secimi",
    title: "Çocuğunuz İçin Doğru Okul Nasıl Seçilir?",
    excerpt: "Okul seçimi yaparken dikkat edilmesi gereken kriterler, eğitim kalitesi ve çocuğunuzun gelişimi için önemli faktörler...",
    category: "Okul",
    date: "05 EKİM 2023",
    authorName: "Ayşe Yılmaz",
    coverImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Çocuğunuzun eğitim hayatındaki en önemli kararlardan biri okul seçimidir. Doğru okul, çocuğunuzun akademik başarısını, sosyal gelişimini ve geleceğini şekillendirir. Bu yazıda, çocuğunuz için en uygun okulu seçerken dikkat etmeniz gereken temel kriterleri ele alacağız.' },
      { type: 'h2', text: 'Eğitim Programı ve Müfredat' },
      { type: 'paragraph', text: 'Okulun eğitim programını ve müfredatını detaylıca inceleyin. Çocuğunuzun ilgi alanlarına ve öğrenme stiline uygun bir program seçin. Yabancı dil eğitimi, sanat ve spor programları gibi ek aktiviteleri de değerlendirin.' },
      { type: 'h2', text: 'Öğretmen Kalitesi' },
      { type: 'paragraph', text: 'Öğretmenler, eğitimin kalitesini belirleyen en önemli faktördür. Okulun öğretmen seçim kriterlerini, eğitim geçmişlerini ve sürekli gelişim programlarını araştırın.' },
      { type: 'h2', text: 'Okul Kültürü ve Değerleri' },
      { type: 'paragraph', text: 'Okulun kültürü ve değerleri, çocuğunuzun karakter gelişimini etkiler. Okulun eğitim felsefesini, disiplin yaklaşımını ve öğrenci-öğretmen ilişkilerini gözlemleyin.' },
      { type: 'h2', text: 'Fiziksel Olanaklar' },
      { type: 'paragraph', text: 'Okulun fiziksel olanakları - sınıflar, laboratuvarlar, kütüphane, spor salonu, bahçe - çocuğunuzun eğitim deneyimini etkiler. Modern ve güvenli bir ortam arayın.' }
    ]
  },
  {
    slug: "lgs-hazirlik-altin-kurallar",
    title: "LGS'ye Hazırlık: Başarı İçin 10 Altın Kural",
    excerpt: "LGS sınavına etkili hazırlık stratejileri, zaman yönetimi ve motivasyon teknikleri ile başarıya giden yol...",
    category: "Kurs & Sınav",
    date: "01 EKİM 2023",
    authorName: "Caner Erkin",
    coverImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'LGS (Liselere Geçiş Sınavı), öğrencilerin eğitim hayatındaki önemli dönüm noktalarından biridir. Başarılı bir hazırlık süreci, doğru strateji, disiplin ve motivasyon gerektirir. İşte LGS\'ye hazırlanan öğrenciler için 10 altın kural:' },
      { type: 'h2', text: '1. Erken Başlayın' },
      { type: 'paragraph', text: 'Hazırlık sürecine mümkün olduğunca erken başlayın. 7. sınıftan itibaren düzenli çalışma alışkanlığı kazanmak, 8. sınıfta daha rahat bir hazırlık süreci geçirmenizi sağlar.' },
      { type: 'h2', text: '2. Planlı Çalışın' },
      { type: 'paragraph', text: 'Haftalık ve aylık çalışma planları oluşturun. Her ders için yeterli zaman ayırın ve planınıza sadık kalın.' },
      { type: 'h2', text: '3. Düzenli Tekrar Yapın' },
      { type: 'paragraph', text: 'Öğrendiklerinizi unutmamak için düzenli tekrar yapın. Eski konuları belirli aralıklarla gözden geçirin.' },
      { type: 'h2', text: '4. Deneme Sınavları Çözün' },
      { type: 'paragraph', text: 'Düzenli olarak deneme sınavları çözerek kendinizi test edin. Zayıf olduğunuz konuları belirleyin ve onlara özel çalışın.' },
      { type: 'h2', text: '5. Sağlıklı Yaşam' },
      { type: 'paragraph', text: 'Düzenli uyku, sağlıklı beslenme ve fiziksel aktivite, zihinsel performansınızı artırır. Kendinize iyi bakın.' }
    ]
  },
  {
    slug: "cocuklarda-spor-aliskanligi",
    title: "Çocuklarda Spor Alışkanlığı Nasıl Kazandırılır?",
    excerpt: "Çocuğunuzun yaşına uygun spor dalları, fiziksel gelişim ve sosyal beceriler için sporun önemi...",
    category: "Spor",
    date: "28 EYLÜL 2023",
    authorName: "Elif Şafak",
    coverImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Spor, çocukların fiziksel, zihinsel ve sosyal gelişimi için kritik öneme sahiptir. Düzenli spor yapan çocuklar, daha sağlıklı, özgüvenli ve disiplinli bireyler olarak yetişir. Bu yazıda, çocuklarınıza spor alışkanlığı kazandırmanın yollarını keşfedeceğiz.' },
      { type: 'h2', text: 'Yaşa Uygun Spor Seçimi' },
      { type: 'paragraph', text: 'Çocuğunuzun yaşına ve gelişim seviyesine uygun spor dallarını seçin. Küçük yaşlarda eğlenceli ve temel motor becerileri geliştiren aktiviteler, ilerleyen yaşlarda daha spesifik spor dalları tercih edilebilir.' },
      { type: 'h2', text: 'Rol Model Olun' },
      { type: 'paragraph', text: 'Çocuklar ebeveynlerini taklit eder. Siz de düzenli spor yaparak çocuğunuza örnek olun. Birlikte yapabileceğiniz aktiviteler planlayın.' },
      { type: 'h2', text: 'Eğlenceli Hale Getirin' },
      { type: 'paragraph', text: 'Sporu bir zorunluluk değil, eğlence kaynağı olarak sunun. Oyun tabanlı aktiviteler, çocukların spora olan ilgisini artırır.' },
      { type: 'h2', text: 'Destekleyici Ortam' },
      { type: 'paragraph', text: 'Çocuğunuzun spor yapması için uygun ortam ve ekipman sağlayın. Başarılarını kutlayın ve zorlandığında destek olun.' }
    ]
  },
  {
    slug: "sanatin-cocuk-gelisimine-etkisi",
    title: "Sanatın Çocuk Gelişimine Etkisi",
    excerpt: "Resim, müzik ve dans gibi sanat dallarının çocukların yaratıcılık, motor beceri ve duygusal gelişimine katkıları...",
    category: "Sanat",
    date: "25 EYLÜL 2023",
    authorName: "Murat Boz",
    coverImage: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Sanat, çocukların bilişsel, duygusal ve sosyal gelişiminde önemli bir rol oynar. Resim, müzik, dans ve tiyatro gibi sanat dalları, çocukların yaratıcılığını, özgüvenini ve ifade becerilerini geliştirir.' },
      { type: 'h2', text: 'Yaratıcılık ve Hayal Gücü' },
      { type: 'paragraph', text: 'Sanat aktiviteleri, çocukların hayal gücünü ve yaratıcı düşünme becerilerini geliştirir. Farklı materyaller ve tekniklerle deneyim yapma fırsatı sunar.' },
      { type: 'h2', text: 'Motor Beceri Gelişimi' },
      { type: 'paragraph', text: 'Resim yapma, müzik aleti çalma ve dans etme gibi aktiviteler, ince ve kaba motor becerilerin gelişimine katkıda bulunur.' },
      { type: 'h2', text: 'Duygusal İfade' },
      { type: 'paragraph', text: 'Sanat, çocukların duygularını ifade etmeleri için güvenli bir alan sağlar. Özellikle sözel ifade güçlüğü yaşayan çocuklar için önemlidir.' },
      { type: 'h2', text: 'Özgüven ve Başarı Duygusu' },
      { type: 'paragraph', text: 'Sanat eserleri oluşturmak, çocuklara başarı duygusu verir ve özgüvenlerini artırır. Her çalışma, çocuğun kendini ifade etme ve değer görme ihtiyacını karşılar.' }
    ]
  },
  {
    slug: "yabanci-dil-ogrenme-yollari",
    title: "Yabancı Dil Öğrenmenin En Etkili Yolları",
    excerpt: "Dil öğrenme sürecini hızlandıran teknikler, pratik yapma yöntemleri ve motivasyonu yüksek tutma stratejileri...",
    category: "Yabancı Dil",
    date: "12 EKİM 2023",
    authorName: "Zeynep Yılmaz",
    coverImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Yabancı dil öğrenmek, günümüz dünyasında hem kişisel hem de profesyonel gelişim için kritik öneme sahiptir. Ancak dil öğrenme süreci bazen zorlu görünebilir. İşte dil öğrenmeyi daha etkili ve eğlenceli hale getirecek stratejiler:' },
      { type: 'h2', text: 'Düzenli Pratik' },
      { type: 'paragraph', text: 'Dil öğrenmede tutarlılık anahtardır. Her gün en az 15-30 dakika ayırın. Kısa ama düzenli çalışma seansları, uzun ama seyrek çalışmalardan daha etkilidir.' },
      { type: 'h2', text: 'Çoklu Öğrenme Yöntemleri' },
      { type: 'paragraph', text: 'Farklı öğrenme yöntemlerini birleştirin: dinleme (podcast, müzik), okuma (kitap, makale), yazma (günlük, notlar) ve konuşma (dil değişimi, pratik).' },
      { type: 'h2', text: 'Gerçek Hayat Bağlamı' },
      { type: 'paragraph', text: 'Dili gerçek hayat durumlarında kullanın. Film ve dizi izleyin, haber okuyun, o dilde konuşan insanlarla iletişim kurun.' },
      { type: 'h2', text: 'Hata Yapmaktan Korkmayın' },
      { type: 'paragraph', text: 'Hatalar öğrenme sürecinin doğal bir parçasıdır. Konuşurken hata yapmaktan çekinmeyin - her hata bir öğrenme fırsatıdır.' },
      { type: 'h2', text: 'Motivasyonu Yüksek Tutun' },
      { type: 'paragraph', text: 'Dil öğrenme hedefinizi netleştirin. İş, seyahat, kültür veya kişisel gelişim - amacınızı hatırlamak motivasyonunuzu korur.' }
    ]
  },
  {
    slug: "etkili-iletisim-becerileri",
    title: "Etkili İletişim Becerileri Geliştirme",
    excerpt: "Günlük hayatta ve iş yaşamında başarılı iletişim kurma teknikleri, empati ve aktif dinleme becerileri...",
    category: "Kişisel Gelişim",
    date: "10 EKİM 2023",
    authorName: "Ahmet Demir",
    coverImage: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Etkili iletişim, kişisel ve profesyonel ilişkilerimizin temelidir. İyi bir iletişimci olmak, sadece konuşmak değil, aynı zamanda dinlemek, anlamak ve uygun şekilde yanıt vermek anlamına gelir.' },
      { type: 'h2', text: 'Aktif Dinleme' },
      { type: 'paragraph', text: 'Aktif dinleme, sadece duymak değil, anlamak ve yanıt vermektir. Karşınızdaki kişiye tam dikkatinizi verin, göz teması kurun ve geri bildirim sağlayın.' },
      { type: 'h2', text: 'Empati Kurma' },
      { type: 'paragraph', text: 'Kendinizi karşınızdaki kişinin yerine koyun. Onların duygularını ve bakış açılarını anlamaya çalışın. Empati, güven ve anlayış oluşturur.' },
      { type: 'h2', text: 'Net ve Açık Konuşma' },
      { type: 'paragraph', text: 'Mesajınızı net ve anlaşılır bir şekilde iletin. Gereksiz jargon kullanmaktan kaçının ve karmaşık fikirleri basit terimlerle açıklayın.' },
      { type: 'h2', text: 'Sözsüz İletişim' },
      { type: 'paragraph', text: 'Beden dili, yüz ifadeleri ve ses tonu, mesajınızın önemli bir parçasıdır. Sözsüz ipuçlarına dikkat edin ve kendi sözsüz iletişiminizi bilinçli kullanın.' }
    ]
  },
  {
    slug: "dijital-cagda-mesleki-beceriler",
    title: "Dijital Çağda Mesleki Beceriler",
    excerpt: "Teknoloji ile birlikte değişen iş dünyasında öne çıkan mesleki beceriler ve kariyer planlama stratejileri...",
    category: "Kariyer",
    date: "08 EKİM 2023",
    authorName: "Mehmet Kaya",
    coverImage: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop",
    content: [
      { type: 'paragraph', text: 'Dijital dönüşüm, iş dünyasını köklü bir şekilde değiştiriyor. Bugünün iş piyasasında başarılı olmak için, geleneksel becerilere ek olarak yeni dijital yetkinliklere sahip olmak gerekiyor.' },
      { type: 'h2', text: 'Dijital Okuryazarlık' },
      { type: 'paragraph', text: 'Temel bilgisayar becerileri artık yeterli değil. Bulut teknolojileri, veri analizi, dijital pazarlama ve proje yönetim araçları gibi konularda bilgi sahibi olmak önemlidir.' },
      { type: 'h2', text: 'Uyum Sağlama ve Öğrenme' },
      { type: 'paragraph', text: 'Teknoloji hızla değişiyor. Sürekli öğrenme ve yeni teknolojilere uyum sağlama yeteneği, kariyer başarısı için kritiktir.' },
      { type: 'h2', text: 'Uzaktan Çalışma Becerileri' },
      { type: 'paragraph', text: 'Uzaktan çalışma, modern iş dünyasının bir parçası haline geldi. Zaman yönetimi, dijital iletişim ve öz disiplin gibi beceriler önem kazandı.' },
      { type: 'h2', text: 'Veri Analizi' },
      { type: 'paragraph', text: 'Veri odaklı karar verme, iş dünyasında giderek daha önemli hale geliyor. Temel veri analizi ve yorumlama becerileri, birçok sektörde avantaj sağlar.' }
    ]
  }
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return allBlogPosts.find(post => post.slug === slug);
}
