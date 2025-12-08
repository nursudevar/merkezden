"use client";
import React, { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/faq.scss";

type FaqTab = "students" | "institutions" | "instructors";

const FaqPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FaqTab>("students");

  const studentsRef = useRef<HTMLDivElement | null>(null);
  const institutionsRef = useRef<HTMLDivElement | null>(null);
  const instructorsRef = useRef<HTMLDivElement | null>(null);

  const handleTabClick = (tab: FaqTab) => {
    setActiveTab(tab);
    const target =
      tab === "students"
        ? studentsRef.current
        : tab === "institutions"
        ? institutionsRef.current
        : instructorsRef.current;

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div className="faq-page">
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

      <main className="faq-page__container">
        {/* Header */}
        <header className="faq-header">
          <h1 className="faq-header__title">Sıkça Sorulan Sorular</h1>
          <p className="faq-header__subtitle">
            Merak ettiğiniz her şey burada. Aradığınız cevabı bulmanıza
            yardımcı olalım.
          </p>
        </header>

        {/* Top Tabs */}
        <nav className="faq-tabs" aria-label="SSS kategorileri">
          <button
            type="button"
            className={
              "faq-tabs__item" +
              (activeTab === "students" ? " faq-tabs__item--active" : "")
            }
            onClick={() => handleTabClick("students")}
          >
            Öğrenciler İçin
          </button>
          <button
            type="button"
            className={
              "faq-tabs__item" +
              (activeTab === "institutions" ? " faq-tabs__item--active" : "")
            }
            onClick={() => handleTabClick("institutions")}
          >
            Kurumlar İçin
          </button>
          <button
            type="button"
            className={
              "faq-tabs__item" +
              (activeTab === "instructors" ? " faq-tabs__item--active" : "")
            }
            onClick={() => handleTabClick("instructors")}
          >
            Eğitimciler İçin
          </button>
        </nav>

        {/* Students Section */}
        <section
          className="faq-section"
          aria-labelledby="faq-students-title"
          ref={studentsRef}
          id="faq-students"
        >
          <h2 className="faq-section__title" id="faq-students-title">
            Öğrenciler İçin
          </h2>
          <div className="faq-card">
            <FaqItem
              question="Platforma nasıl kayıt olabilirim?"
              answer="Ana sayfamızdaki Kayıt Ol butonuna tıklayarak gerekli bilgileri doldurup birkaç adımda hesabınızı oluşturabilirsiniz. E-posta adresinize gönderilecek doğrulama linkine tıklamayı unutmayın."
            />
            <FaqItem
              question="Kurs ücretleri ve burs imkanları nelerdir?"
              answer="Kurs ücretleri, kurumlara ve program türlerine göre değişiklik gösterir. İlgilendiğiniz kursun detay sayfasında güncel fiyat bilgisini ve varsa burs/indirim seçeneklerini görebilirsiniz."
            />
            <FaqItem
              question="Ders materyallerine nasıl erişebilirim?"
              answer="Kayıt olduğunuz kursların tüm ders notları, videoları ve ek materyallerine Hesabım alanındaki kurslarım bölümünden ulaşabilirsiniz. Materyaller hem masaüstü hem de mobil cihazlarla uyumludur."
            />
            <FaqItem
              question="Kayıt olduktan sonra kursumu değiştirebilir miyim?"
              answer="Kurs değişikliği, kurumun iade ve değişim politikalarına göre yapılabilmektedir. İlgili kurs sayfasındaki koşulları inceleyebilir veya destek ekibimizle iletişime geçerek detaylı bilgi alabilirsiniz."
            />
          </div>
        </section>

        {/* Institutions Section */}
        <section
          className="faq-section"
          aria-labelledby="faq-institutions-title"
          ref={institutionsRef}
          id="faq-institutions"
        >
          <h2 className="faq-section__title" id="faq-institutions-title">
            Kurumlar İçin
          </h2>
          <div className="faq-card">
            <FaqItem
              question="Kurum olarak platforma nasıl katılabilirim?"
              answer="Kurum başvuru formumuzu doldurarak kurum bilgilerinizi, iletişim detaylarınızı ve sunmak istediğiniz programları bizimle paylaşabilirsiniz. Ekibimiz başvurunuzu inceleyip en kısa sürede sizinle iletişime geçer."
            />
            <FaqItem
              question="Kurumsal panelde neleri yönetebilirim?"
              answer="Kurumsal panel üzerinden programlarınızı ekleyebilir ve güncelleyebilir, kontenjan ve fiyat bilgilerini yönetebilir, başvuruları takip edebilir ve gelen mesajlara yanıt verebilirsiniz."
            />
            <FaqItem
              question="Faturalandırma ve sözleşme süreci nasıl işliyor?"
              answer="Faturalandırma ve sözleşme süreci, kurumunuzla yapılan anlaşma çerçevesinde yürütülür. Gerekli tüm belgeler ve ödeme planı, iş birliği süreci başlamadan önce sizinle paylaşılır."
            />
            <FaqItem
              question="Kurum profilimi nasıl öne çıkarabilirim?"
              answer="Güncel ve detaylı bir kurum profili, açıklayıcı program içerikleri ve öğrencilerden gelen olumlu geri bildirimler görünürlüğünüzü artırır. Dilerseniz dönemsel kampanyalar ve öne çıkarma çalışmaları için ekibimizle de iletişime geçebilirsiniz."
            />
          </div>
        </section>

        {/* Instructors Section */}
        <section
          className="faq-section"
          aria-labelledby="faq-instructors-title"
          ref={instructorsRef}
          id="faq-instructors"
        >
          <h2 className="faq-section__title" id="faq-instructors-title">
            Eğitimciler İçin
          </h2>
          <div className="faq-card">
            <FaqItem
              question="Platformda nasıl eğitimci olabilirim?"
              answer="Eğitimci başvuru formumuzu doldurarak uzmanlık alanınızı, deneyiminizi ve vermek istediğiniz eğitimleri bizimle paylaşabilirsiniz. Ekibimiz başvurunuzu inceleyip en kısa sürede sizinle iletişime geçer."
            />
            <FaqItem
              question="Kurs içeriklerimi nasıl yükleyebilirim?"
              answer="Eğitimci panelinizde yer alan Kurs Oluştur adımlarını takip ederek video, doküman ve ek materyalleri kolayca yükleyebilirsiniz. İçeriklerinizi dilediğiniz zaman güncelleyebilir veya yeni modüller ekleyebilirsiniz."
            />
            <FaqItem
              question="Ödemeler ve gelir paylaşımı nasıl işliyor?"
              answer="Satın alınan her kurs için gelir paylaşımı, sözleşmede belirtilen oranlar üzerinden gerçekleştirilir. Kazançlarınız, belirli periyotlarda onaylanan bakiyeniz üzerinden hesabınıza aktarılır ve tüm detaylara eğitimci panelinizden ulaşabilirsiniz."
            />
            <FaqItem
              question="Kurslarımın görünürlüğünü artırmak için neler yapabilirim?"
              answer="Düzenli güncellenen içerikler, açıklayıcı kurs başlıkları, net hedef kitle tanımı ve öğrenci geri bildirimleri görünürlüğünüzü artırır. Ekibimiz gerektiğinde kampanya ve öne çıkarma çalışmaları konusunda da size destek olabilir."
            />
          </div>
        </section>

        {/* Call To Action */}
        <section className="faq-cta">
          <div className="faq-cta__card">
            <h2 className="faq-cta__title">Sorunuzu bulamadınız mı?</h2>
            <p className="faq-cta__subtitle">
              Ekibimiz size yardımcı olmaktan mutluluk duyar. Bizimle
              iletişime geçmekten çekinmeyin.
            </p>
            <Link href="/contact" className="faq-cta__button">
              Bize Ulaşın
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

type FaqItemProps = {
  question: string;
  answer: string;
};

const FaqItem: React.FC<FaqItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className={"faq-item" + (isOpen ? " faq-item--open" : "")}>
      <button
        type="button"
        className="faq-item__header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="faq-item__question">{question}</span>
        <span className="faq-item__icon" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && (
        <div className="faq-item__body">
          <p className="faq-item__answer">{answer}</p>
        </div>
      )}
    </article>
  );
};

export default FaqPage;

