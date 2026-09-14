/**
 * Kategori sayfası on-page SEO (H1 + uzun açıklama) ve head metadata kaynakları.
 * Konum / query parametrelerine bağlı değildir; yalnızca kategori slug’ına göre sabittir.
 */

export type CategorySeoTextPart =
  | { type: "text"; value: string }
  | { type: "strong"; value: string };

export type CategorySeoContent = {
  /** URL path segment (ör. okul, spor) */
  slug: string;
  /** getCategoryPageMetadata eşlemesi için kategori adı */
  categoryName: string;
  h1: string;
  metaTitle: string;
  /** ~140–160 karakter kısa meta description */
  metaDescription: string;
  /** Sayfada gösterilen uzun SEO gövdesi (DOM’da her zaman mevcut) */
  body: CategorySeoTextPart[];
};

function parts(...items: Array<string | CategorySeoTextPart>): CategorySeoTextPart[] {
  return items.map((item) =>
    typeof item === "string" ? { type: "text" as const, value: item } : item,
  );
}

const strong = (value: string): CategorySeoTextPart => ({ type: "strong", value });

/**
 * Slug → SEO içeriği. Pathname son segmenti ile eşleşir.
 */
export const CATEGORY_SEO_BY_SLUG: Record<string, CategorySeoContent> = {
  okul: {
    slug: "okul",
    categoryName: "Okul",
    h1: "Okullar ve Eğitim Kurumları",
    metaTitle: "Okullar ve Eğitim Kurumları | Merkezden",
    metaDescription:
      "Anaokulundan liseye okulları Merkezden’de keşfedin. Konum, okul türü ve özelliklere göre filtreleyin; kurum profillerini inceleyerek seçiminizi netleştirin.",
    body: parts(
      "Merkezden üzerinde ",
      strong("okullar ve eğitim kurumları"),
      " arasından size uygun seçenekleri keşfetmek için tasarlanmış bir kategori sayfasındasınız. Anaokulu, ilkokul, ortaokul ve lise gibi okul türlerini birlikte veya ayrı ayrı seçebilir; lise seçildiğinde lise türü filtreleriyle aramanızı daha da netleştirebilirsiniz. Konum filtreleriyle il, ilçe ve mahalle düzeyinde daraltma yapabilir, başlıca özellikler ve kurum profilindeki diğer alanlara göre listeyi sadeleştirebilirsiniz. Bu yapı, geniş bir kurum kümesi içinde kaybolmadan ihtiyacınıza yakın sonuçlara ulaşmanızı kolaylaştırır.",
      "\n\n",
      "Sonuç listesinde her kurum için özet bilgiler ve profil bağlantısı yer alır; kart üzerinden kurum detayına geçerek eğitim yaklaşımı, hizmet kapsamı ve iletişim bilgilerini inceleyebilirsiniz. Sol paneldeki harita işaretleri, listeyle aynı filtre kapsamındaki kurumları coğrafi olarak görmenize yardımcı olur. Favorilere ekleme ile ilgilendiğiniz okulları daha sonra kolayca bulabilirsiniz. Arama kutusu kurum adına göre hızlı süzme sağlar; filtreleri sıfırlama ile varsayılan görünüme dönebilirsiniz.",
      "\n\n",
      "Sayfalama ile uzun listelerde gezinmek mümkündür. Merkezden, farklı okul türlerini tek ekranda değerlendirmenize olanak tanıyarak eğitim yolculuğunuzda bilinçli bir seçim yapmanıza destek olur. Filtreleri ihtiyacınıza göre değiştirip sonuçları yeniden gözden geçirerek ",
      strong("okul"),
      " arayışınızı adım adım netleştirebilirsiniz. Aileler için kritik olan yaş grubu, okul türü ve konum dengesi bu sayfada pratik biçimde bir araya gelir; böylece karar süreciniz daha düzenli ve şeffaf ilerler.",
    ),
  },

  "kurs-ve-sinava-hazirlik": {
    slug: "kurs-ve-sinava-hazirlik",
    categoryName: "Kurs & Sınava Hazırlık",
    h1: "Kurs ve Sınava Hazırlık Merkezleri",
    metaTitle: "Kurs ve Sınava Hazırlık Merkezleri | Merkezden",
    metaDescription:
      "YKS, LGS, KPSS ve branş kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek hazırlık sürecinizi planlayın.",
    body: parts(
      "Bu sayfada ",
      strong("kurs ve sınava hazırlık"),
      " alanında hizmet veren kurumları Merkezden üzerinden keşfedebilirsiniz. Sınav odaklı programlar, branş takviyeleri ve yoğun hazırlık süreçleri için uygun merkezleri listeden tarayabilir; konum filtreleriyle yaşadığınız bölgeye yakın seçeneklere odaklanabilirsiniz. Kategoriye özel özellik filtreleri, program kapsamı ve kurumun sunduğu hizmetlere göre sonuçları daraltmanıza yardımcı olur. Böylece hedef sınavınıza veya çalışma temposunuza uygun seçenekleri daha hızlı ayıklarsınız.",
      "\n\n",
      "Her sonuç kartı kurumun temel bilgilerini özetler; detay sayfasına geçerek programlar, çalışma düzeni ve iletişim kanalları hakkında daha fazla bilgiye ulaşabilirsiniz. Sol paneldeki harita görünümü, filtrelenmiş kurumların konumunu tek bakışta görmenizi sağlar. Favori özelliğiyle kısa listenizi oluşturabilir, sayfalama ile uzun sonuç kümelerinde gezinmeye devam edebilirsiniz. Arama alanı kurum adına göre hızlı süzme imkânı sunar; filtreleri temizlediğinizde liste varsayılan haline döner.",
      "\n\n",
      "Merkezden, farklı hazırlık ihtiyaçlarını aynı arayüzde topladığı için deneme sınavı temposundan uzun dönemli kurslara kadar seçenekleri yan yana değerlendirebilirsiniz. Hedef sınavınıza ve çalışma tarzınıza uygun ",
      strong("kurs"),
      " merkezini bulmak için filtreleri güncelleyip profilleri incelemeniz yeterlidir. Bu sayfa, hazırlık yolculuğunuzda kurumları karşılaştırmak ve karar vermek için sade, odaklı bir başlangıç noktası sunar. Hedefiniz netleştikçe konum ve özellik filtrelerini yeniden ayarlayarak sonuçları daha isabetli hale getirebilir, kurum profillerini yan yana değerlendirerek kararınızı güçlendirebilirsiniz.",
    ),
  },

  spor: {
    slug: "spor",
    categoryName: "Spor",
    h1: "Spor Kursları, Kurumları ve Eğitmenleri",
    metaTitle: "Spor Kursları, Kurumları ve Eğitmenleri | Merkezden",
    metaDescription:
      "Spor kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek size uygun tesisi bulun.",
    body: parts(
      "Merkezden ",
      strong("spor"),
      " kategorisinde spor kursları, kulüpler ve ilgili eğitim hizmetlerini sunan kurumları bir araya getirir. Yaş grubu, branş veya tesis özelliklerine göre filtreleyerek listenizi sadeleştirebilir; il, ilçe ve mahalle seçimleriyle size yakın seçeneklere odaklanabilirsiniz. Sonuçlar arasında gezinirken her kurumun özet kartından profil sayfasına geçerek program ve hizmet bilgilerini inceleyebilirsiniz. Bu akış, hem hobi hem de daha düzenli antrenman arayanlar için pratik bir keşif deneyimi sunar.",
      "\n\n",
      "Sol taraftaki harita işaretleri, aktif filtrelerle uyumlu kurumları harita üzerinde gösterir. Favorilere ekleme, ilgilendiğiniz spor merkezlerini kaydetmenizi sağlar. Arama kutusuyla kurum adına göre hızlı süzme yapabilir, filtreleri sıfırlayarak baştan tarama yapabilirsiniz. Sayfalama, geniş listelerde düzenli gezinmeyi kolaylaştırır. Böylece çok sayıda seçenek arasında kaybolmadan ilerleyebilirsiniz.",
      "\n\n",
      "Bu sayfa; bireysel antrenman, grup dersi veya kulüp ortamı arayanlar için ortak bir keşif noktasıdır. Merkezden’de yer alan kurum profilleri sayesinde tesis ve program bilgilerini tek yerden değerlendirebilir, ihtiyacınıza uyan ",
      strong("spor"),
      " eğitim seçeneklerini daha bilinçli biçimde seçebilirsiniz. Filtreleri değiştirip sonuçları yeniden gözden geçirerek aramanızı netleştirmeye devam edebilirsiniz; karar aşamasında size zaman kazandırır. Branş ve konum önceliklerinize göre listeyi yeniden şekillendirerek size en yakın spor eğitim seçeneklerini daha hızlı ayıklayabilirsiniz.",
    ),
  },

  sanat: {
    slug: "sanat",
    categoryName: "Sanat",
    h1: "Sanat Kursları ve Eğitimleri",
    metaTitle: "Sanat Kursları ve Eğitimleri | Merkezden",
    metaDescription:
      "Resim, müzik ve dans kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek uygun atölyeyi bulun.",
    body: parts(
      "Bu kategoride ",
      strong("sanat"),
      " alanında kurs ve atölye hizmeti veren kurumları Merkezden üzerinden inceleyebilirsiniz. Resim, müzik, dans veya diğer yaratıcı disiplinlerde eğitim arıyorsanız konum ve özellik filtreleriyle sonuçları ihtiyacınıza göre daraltabilirsiniz. Liste görünümünde kurum özetlerini görür, karttan profil detayına geçerek program içeriği ve iletişim bilgilerine ulaşabilirsiniz. Farklı disiplinleri aynı sayfada tarayabilmek, seçenekleri yan yana değerlendirmenizi kolaylaştırır.",
      "\n\n",
      "Harita paneli, seçtiğiniz filtrelerle uyumlu kurumların coğrafi dağılımını gösterir. Favori listenize eklediğiniz atölyeleri daha sonra hızlıca bulabilirsiniz. Kurum adı araması ve filtreleri sıfırlama, keşif sürecinizi esnek tutar. Sayfalama sayesinde çok sayıda sonuç arasında düzenli şekilde ilerlersiniz. Bu araçlar birlikte, geniş bir kurum kümesini yönetilebilir hale getirir.",
      "\n\n",
      "Merkezden, sanat eğitimini arayanlar için kurumları tek bir akışta toplar; böylece farklı disiplinleri ve yaklaşım biçimlerini yan yana değerlendirebilirsiniz. İster hobi ister daha yapılandırılmış bir program olsun, filtreleri güncelleyerek size uygun ",
      strong("sanat"),
      " kursunu bulmaya odaklanabilirsiniz. Profilleri inceleyip seçeneklerinizi netleştirmek için bu sayfayı başlangıç noktası olarak kullanın; kararınızı adım adım güçlendirebilirsiniz. Merkezden’de filtre, harita ve kurum profili aynı akışta birleştiği için arayışınızı bölmeden sürdürebilir, ihtiyacınıza en yakın sanat eğitim seçeneklerini daha rahat ayıklayabilirsiniz.",
    ),
  },

  "yabanci-dil": {
    slug: "yabanci-dil",
    categoryName: "Yabancı Dil",
    h1: "Yabancı Dil Kursları ve Eğitmenleri",
    metaTitle: "Yabancı Dil Kursları ve Eğitmenleri | Merkezden",
    metaDescription:
      "Yabancı dil kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek seviyenize uygun programı bulun.",
    body: parts(
      "Merkezden ",
      strong("yabancı dil"),
      " kategorisinde dil kursları ve ilgili eğitim hizmetlerini sunan kurumları listeler. Seviye, dil veya program özelliklerine göre filtreleyerek aramanızı daraltabilir; konum seçenekleriyle size yakın merkezlere odaklanabilirsiniz. Sonuç kartlarından kurum profiline geçerek eğitim formatı, hizmet kapsamı ve iletişim bilgilerini inceleyebilirsiniz. Bu düzen, sınav hazırlığından günlük iletişim becerisine kadar farklı hedefleri olan kullanıcılar için ortak bir keşif alanı sunar.",
      "\n\n",
      "Sol paneldeki harita, aktif filtrelerle eşleşen kurumları konum bazlı gösterir. Favoriler, kısa listenizi oluşturmanıza yardımcı olur. Arama alanı kurum adına göre süzme sağlar; filtreleri temizleyerek geniş tarama yapabilirsiniz. Sayfalama, uzun listelerde gezinmeyi kolaylaştırır. Böylece çok sayıda dil eğitim seçeneğini sistemli biçimde tarayabilirsiniz.",
      "\n\n",
      "İster sınav odaklı bir program ister günlük iletişim becerisi hedefliyor olun, bu sayfa farklı dil eğitimi seçeneklerini tek yerde toplar. Merkezden üzerinden kurumları keşfedip profillerini inceleyerek size uygun ",
      strong("yabancı dil"),
      " kursunu daha net biçimde değerlendirebilirsiniz. Filtreleri ihtiyacınıza göre değiştirerek sonuçları yeniden gözden geçirmeye devam edin; seçiminizi güçlendirmek için yeterli esnekliği bulursunuz. Dil eğitimi arayışında konum, program özellikleri ve kurum profili bilgilerini birlikte kullanarak kararınızı daha güvenle netleştirebilirsiniz.",
    ),
  },

  "kisisel-gelisim": {
    slug: "kisisel-gelisim",
    categoryName: "Kişisel Gelişim",
    h1: "Kişisel Gelişim Eğitimleri ve Kursları",
    metaTitle: "Kişisel Gelişim Eğitimleri ve Kursları | Merkezden",
    metaDescription:
      "Kişisel gelişim kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek hedefinize uygun programı bulun.",
    body: parts(
      "Bu sayfada ",
      strong("kişisel gelişim"),
      " alanında eğitim ve kurs hizmeti veren kurumları Merkezden üzerinden keşfedebilirsiniz. Koçluk, iletişim, liderlik veya beceri odaklı programlar arıyorsanız özellik ve konum filtreleriyle listeyi sadeleştirebilirsiniz. Her sonuç kartı kurum hakkında özet bilgi sunar; detay sayfasında program ve hizmet kapsamını daha yakından inceleyebilirsiniz. Farklı ihtiyaçlara hitap eden kurumları aynı akışta görmek, arayışınızı daha düzenli hale getirir.",
      "\n\n",
      "Harita görünümü, filtrelenmiş kurumları coğrafi olarak takip etmenizi sağlar. Favorilere ekleme ile ilgilendiğiniz merkezleri kaydedebilirsiniz. Kurum adı araması ve filtreleri sıfırlama, keşfi esnek tutar. Sayfalama ile sonuçlar arasında adım adım ilerleyebilirsiniz. Bu araçlar, geniş bir seçenek kümesini yönetilebilir ve karşılaştırılabilir kılar.",
      "\n\n",
      "Merkezden, kişisel gelişim yolculuğunda farklı kurumları tek ekranda görmenizi kolaylaştırır. Hedefinize uygun formatı bulmak için filtreleri güncelleyip profilleri inceleyebilir; böylece ",
      strong("kişisel gelişim"),
      " eğitim seçeneklerinizi daha bilinçli biçimde daraltabilirsiniz. Bu kategori sayfası, arayışınızı yapılandırmak için pratik bir başlangıç noktasıdır ve karar sürecinizi sadeleştirir. Filtre, harita ve kurum detayı aynı deneyimde birleştiği için hedefiniz netleştikçe listeyi yeniden şekillendirmek kolaylaşır.",
    ),
  },

  "mesleki-egitim": {
    slug: "mesleki-egitim",
    categoryName: "Mesleki Eğitim",
    h1: "Mesleki Eğitim Kursları ve Kurumları",
    metaTitle: "Mesleki Eğitim Kursları ve Kurumları | Merkezden",
    metaDescription:
      "Mesleki eğitim kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek kariyerinize uygun programı bulun.",
    body: parts(
      "Merkezden ",
      strong("mesleki eğitim"),
      " kategorisinde meslek odaklı kurs ve kurumları bir araya getirir. Sertifika programları, uygulamalı atölyeler veya kariyer yönelimli eğitimler arıyorsanız konum ve özellik filtreleriyle sonuçları ihtiyacınıza göre daraltabilirsiniz. Liste kartlarından kurum profiline geçerek program kapsamı ve iletişim bilgilerini inceleyebilirsiniz. Bu yapı, farklı meslek alanlarını tek ekranda taramanızı kolaylaştırır.",
      "\n\n",
      "Sol paneldeki harita işaretleri, seçili filtrelerle uyumlu kurumları gösterir. Favori özelliği kısa listenizi oluşturmanıza yardımcı olur. Arama kutusu kurum adına göre süzme sunar; filtreleri temizleyerek geniş tarama yapabilirsiniz. Sayfalama, geniş sonuç kümelerinde düzenli gezinmeyi destekler. Böylece çok sayıda mesleki eğitim seçeneğini sistemli biçimde değerlendirebilirsiniz.",
      "\n\n",
      "Bu sayfa, mesleki becerilerini geliştirmek isteyenler için kurumları tek akışta toplar. Merkezden üzerinden farklı alanları yan yana değerlendirip size uygun ",
      strong("mesleki eğitim"),
      " seçeneğini netleştirebilirsiniz. Filtreleri güncelleyerek listeyi yeniden şekillendirmek ve profilleri incelemek arayışınızı hızlandırır; karar aşamasında size zaman kazandırır. Mesleki hedefiniz netleştikçe konum ve özellik filtrelerini yeniden ayarlayarak sonuçları daha isabetli hale getirebilirsiniz.",
    ),
  },

  "ozel-egitim": {
    slug: "ozel-egitim",
    categoryName: "Özel Eğitim",
    h1: "Özel Eğitim Kurumları ve Eğitim Seçenekleri",
    metaTitle: "Özel Eğitim Kurumları ve Eğitim Seçenekleri | Merkezden",
    metaDescription:
      "Özel eğitim kurumlarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek ihtiyaca uygun seçenekleri bulun.",
    body: parts(
      "Bu kategoride ",
      strong("özel eğitim"),
      " ve destek hizmetleri sunan kurumları Merkezden üzerinden keşfedebilirsiniz. Uzmanlık alanına, hizmet kapsamına veya konuma göre filtreleyerek size yakın ve ihtiyaca uygun seçeneklere odaklanabilirsiniz. Sonuç kartlarından kurum detayına geçerek program ve iletişim bilgilerini inceleyebilirsiniz. Bu sayfa, hassas bir arayışı daha düzenli ve şeffaf biçimde yürütmenize yardımcı olur.",
      "\n\n",
      "Harita paneli, aktif filtrelerle eşleşen kurumların konumunu gösterir. Favorilere ekleme, değerlendirmek istediğiniz kurumları kaydetmenizi sağlar. Kurum adı araması ve filtreleri sıfırlama, keşif sürecini esnek tutar. Sayfalama ile uzun listelerde adım adım ilerleyebilirsiniz. Bu araçlar birlikte, seçenekleri sakin ve kontrollü biçimde taramanızı kolaylaştırır.",
      "\n\n",
      "Merkezden, özel eğitim arayışında kurumları tek bir ekranda toplar; böylece farklı yaklaşımları ve hizmet türlerini daha rahat değerlendirebilirsiniz. Filtreleri ihtiyacınıza göre ayarlayıp ",
      strong("özel eğitim"),
      " kurum profillerini inceleyerek bilinçli bir seçim yapmanıza yardımcı olur. Bu sayfa, aramanızı yapılandırmak için sade ve odaklı bir başlangıç sunar; karar sürecinizi adım adım netleştirir. İhtiyacınıza göre filtreleri güncelleyip kurum detaylarını yeniden gözden geçirerek seçenekleri sakin biçimde daraltabilirsiniz.",
    ),
  },

  "surucu-kursu": {
    slug: "surucu-kursu",
    categoryName: "Sürücü Kursu",
    h1: "Sürücü Kursları",
    metaTitle: "Sürücü Kursları | Merkezden",
    metaDescription:
      "Sürücü kurslarını Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek size uygun ehliyet eğitim seçeneklerini bulun.",
    body: parts(
      "Merkezden ",
      strong("sürücü kursu"),
      " kategorisinde ehliyet eğitimi veren kurumları listeler. Konum filtreleriyle size yakın kursları öne çıkarabilir; kategoriye özel özelliklerle paket ve hizmet kapsamına göre sonuçları daraltabilirsiniz. Liste kartlarından kurum profiline geçerek eğitim seçenekleri ve iletişim bilgilerini inceleyebilirsiniz. Bu düzen, ehliyet sürecinde kurumları hızlı ve düzenli biçimde taramanızı sağlar.",
      "\n\n",
      "Sol paneldeki harita, filtrelenmiş sürücü kurslarının konumunu gösterir. Favori listenize eklediğiniz kursları daha sonra kolayca bulabilirsiniz. Kurum adı araması hızlı süzme sağlar; filtreleri temizleyerek tüm seçeneklere geri dönebilirsiniz. Sayfalama, geniş listelerde gezinmeyi kolaylaştırır. Böylece çok sayıda kurs arasından size yakın ve uygun olanları ayıklayabilirsiniz.",
      "\n\n",
      "Ehliyet sürecinde doğru kursu seçmek zaman ve planlama ister. Merkezden, farklı ",
      strong("sürücü kursu"),
      " seçeneklerini tek sayfada topladığı için konum ve özelliklere göre değerlendirme yapmanızı kolaylaştırır. Filtreleri güncelleyip profilleri inceleyerek size uygun kursu netleştirmeye devam edebilirsiniz; kararınızı güçlendirmek için pratik bir başlangıç noktasıdır. Ehliyet planınıza göre yakınlık ve hizmet kapsamını birlikte değerlendirerek aramanızı adım adım daraltabilirsiniz.",
    ),
  },

  "patili-dostlar": {
    slug: "patili-dostlar",
    categoryName: "Patili Dostlar",
    h1: "Patili Dostlar İçin Eğitim ve Hizmetler",
    metaTitle: "Patili Dostlar İçin Eğitim ve Hizmetler | Merkezden",
    metaDescription:
      "Patili dostlar için hizmet veren kurumları Merkezden’de keşfedin. Konum ve özelliklere göre filtreleyin; kurum profillerini inceleyerek uygun seçenekleri bulun.",
    body: parts(
      "Bu sayfada ",
      strong("patili dostlar"),
      " için eğitim, bakım ve ilgili hizmetler sunan kurumları Merkezden üzerinden keşfedebilirsiniz. Hizmet türü ve konum filtreleriyle listenizi sadeleştirebilir; size yakın seçeneklere odaklanabilirsiniz. Sonuç kartlarından kurum profiline geçerek hizmet kapsamı ve iletişim bilgilerini inceleyebilirsiniz. Bu akış, evcil hayvan sahiplerinin ihtiyaç duyduğu hizmetleri tek yerde tarama imkânı sunar.",
      "\n\n",
      "Harita paneli, aktif filtrelerle uyumlu kurumları coğrafi olarak gösterir. Favorilere ekleme ile ilgilendiğiniz merkezleri kaydedebilirsiniz. Kurum adı araması ve filtreleri sıfırlama, keşfi esnek tutar. Sayfalama sayesinde çok sayıda sonuç arasında düzenli şekilde ilerlersiniz. Bu araçlar birlikte, geniş bir hizmet kümesini yönetilebilir hale getirir.",
      "\n\n",
      "Merkezden, patili dostlarınız için uygun hizmetleri tek bir akışta toplar. Filtreleri ihtiyacınıza göre ayarlayıp ",
      strong("patili dostlar"),
      " kurum profillerini inceleyerek daha bilinçli bir seçim yapabilirsiniz. Bu kategori sayfası, arayışınızı netleştirmek için pratik bir başlangıç noktasıdır ve karar sürecinizi sadeleştirir. Filtreleri güncelleyip harita ve kurum detaylarını birlikte kullanarak patili dostlarınız için uygun hizmeti daha rahat bulabilirsiniz.",
    ),
  },

  egitmenler: {
    slug: "egitmenler",
    categoryName: "Eğitmenler",
    h1: "Eğitmenler ve Özel Ders Seçenekleri",
    metaTitle: "Eğitmenler ve Özel Ders Seçenekleri | Merkezden",
    metaDescription:
      "Farklı alanlardaki eğitmenleri Merkezden’de keşfedin. Uzmanlık ve profil bilgilerini inceleyin; filtrelerle size uygun eğitmeni daha hızlı bulun.",
    body: parts(
      "Merkezden ",
      strong("eğitmenler"),
      " sayfasında farklı alanlarda hizmet veren eğitmenleri tek listede keşfedebilirsiniz. Uzmanlık alanları, eğitim geçmişi ve profil özetleri üzerinden seçenekleri karşılaştırarak size daha yakın görünen eğitmenlere odaklanabilirsiniz. Konum ve kategori filtreleriyle listeyi daraltmak; arama alanıyla isme göre hızlı süzmek mümkündür. Böylece geniş bir eğitmen kümesi içinde kaybolmadan ihtiyacınıza uygun profillere ulaşmanız kolaylaşır.",
      "\n\n",
      "Her sonuç kartı temel bilgileri özetler; detay sayfasına geçerek eğitmen profilini, sunduğu alanları ve iletişim için gereken bilgileri daha yakından inceleyebilirsiniz. Favorilere ekleme ile ilgilendiğiniz eğitmenleri daha sonra tekrar bulabilirsiniz. Sayfalama, uzun listelerde gezinmeyi kolaylaştırır. Filtreleri sıfırladığınızda liste varsayılan haline döner; seçimlerinizi güncelledikçe sonuçlar yeniden düzenlenir.",
      "\n\n",
      "Bu sayfa, özel ders veya bireysel eğitim arayışında olanlar için sade bir başlangıç noktası sunar. Farklı branşlardaki ",
      strong("eğitmen"),
      " profillerini yan yana değerlendirerek kararınızı adım adım netleştirebilirsiniz. Hedefiniz belirginleştikçe filtreleri yeniden ayarlayıp profil detaylarını inceleyerek size uygun seçeneği daha bilinçli biçimde seçebilirsiniz. Merkezden, eğitmen arayışınızı tek ekranda toplayarak karşılaştırma ve seçim sürecinizi destekler.",
    ),
  },

  "blog-yazilari": {
    slug: "blog-yazilari",
    categoryName: "Blog",
    h1: "Merkezden Blog: Eğitim, Gelişim ve Rehber Yazıları",
    metaTitle: "Merkezden Blog: Eğitim ve Rehber Yazıları | Merkezden",
    metaDescription:
      "Eğitim, okul ve kurs seçimi, sınav hazırlığı ve kişisel gelişim üzerine Merkezden blog yazılarını keşfedin; rehber içeriklerle bilginizi güncelleyin.",
    body: parts(
      "Merkezden ",
      strong("blog"),
      " sayfasında eğitim, okul ve kurs seçimi, sınav hazırlığı, yabancı dil, kişisel gelişim ile eğitmen ve kurum seçimine dair rehber nitelikli yazıları bir arada bulabilirsiniz. Amacımız, karar sürecinizde işinize yarayabilecek bilgilendirici içerikleri sade ve erişilebilir biçimde sunmaktır. Kategori sekmeleriyle belirli bir alana odaklanabilir; grid veya liste görünümüyle okuma tercihinize göre gezebilirsiniz. Seçtiğiniz kategori yalnızca listelenen yazıları süzer; sayfanın genel blog kapsamı aynı kalır.",
      "\n\n",
      "Yazı kartlarında başlık, özet ve kategori bilgisi yer alır; detaya tıklayarak tam metne geçebilirsiniz. Güncel yayınlar ve örnek içerikler, eğitim yolculuğunuzda sık sorulan konulara ışık tutmayı hedefler. Okul türleri, kurs süreçleri, sınav temposu veya dil öğrenme gibi başlıklarda kısa okumalarla fikir edinebilirsiniz. İsterseniz kendi deneyiminizi paylaşmak için blog gönderimi alanından da ilerleyebilirsiniz.",
      "\n\n",
      "Bu listeleme sayfası, Merkezden’deki ",
      strong("eğitim rehberi"),
      " içeriklerine açılan kapıdır. Kurum ve eğitmen profillerini incelerken blog yazıları, bağlam ve ipucu sağlar. Filtre veya görünüm değişse de burada sunulan blog çerçevesi sabittir; böylece aradığınız konuya göre yazıları tararken sayfanın amacı net kalır. Düzenli okuyarak seçeneklerinizi daha bilinçli değerlendirebilir, rehber içeriklerle kararınızı güçlendirebilirsiniz.",
    ),
  },

  duyurular: {
    slug: "duyurular",
    categoryName: "Duyurular",
    h1: "Eğitim Kurumları ve Eğitmenlerden Güncel Duyurular",
    metaTitle: "Eğitim Kurumları ve Eğitmenlerden Güncel Duyurular | Merkezden",
    metaDescription:
      "Kurum ve eğitmen duyurularını Merkezden’de takip edin. Kayıt dönemleri, etkinlikler ve güncel bilgilendirmeleri tek listede inceleyin.",
    body: parts(
      "Merkezden ",
      strong("duyurular"),
      " sayfasında eğitim kurumları ve eğitmenlerden gelen güncel bilgilendirmeleri tek yerde takip edebilirsiniz. Kayıt dönemleri, etkinlikler, program duyuruları ve benzeri güncel paylaşımlar listede yer alabilir. Konum ve duyuru kategorisi filtreleriyle sonuçları daraltarak size daha yakın veya ilgilendiğiniz türdeki duyurulara odaklanabilirsiniz. Ana kategori kartları da ilgili alanlara hızlı geçiş sağlar.",
      "\n\n",
      "Öne çıkan ve liste görünümlerinde başlık, kısa açıklama, tarih ve konum gibi özet bilgiler sunulur; detaya tıklayarak duyurunun tamamını okuyabilirsiniz. Filtreleri temizlediğinizde sayfa varsayılan listesine döner. Konum veya etiket seçiminiz değişse de bu sayfanın genel amacı aynıdır: kurum ve eğitmen duyurularını düzenli biçimde keşfetmek.",
      "\n\n",
      "Bu sayfa, eğitim süreçlerindeki ",
      strong("güncel gelişmeleri"),
      " kaçırmamak isteyenler için pratik bir izleme alanıdır. Kampanya veya program bilgilendirmelerini takip ederken filtreleri ihtiyacınıza göre ayarlayabilir, listede gezinerek size uygun duyuruları ayıklayabilirsiniz. Merkezden, duyuru içeriklerini sade bir arayüzde toplayarak bilgilendirme akışını daha görünür hale getirir; böylece karar ve takip süreciniz daha düzenli ilerler.",
    ),
  },
};

const CATEGORY_SEO_BY_NAME: Record<string, CategorySeoContent> = Object.fromEntries(
  Object.values(CATEGORY_SEO_BY_SLUG).map((entry) => [entry.categoryName, entry]),
);

export function getCategorySeoBySlug(slug: string | null | undefined): CategorySeoContent | null {
  const key = String(slug ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!key) return null;
  return CATEGORY_SEO_BY_SLUG[key] ?? null;
}

export function getCategorySeoByName(categoryName: string | null | undefined): CategorySeoContent | null {
  const name = String(categoryName ?? "").trim();
  if (!name) return null;
  return CATEGORY_SEO_BY_NAME[name] ?? null;
}
