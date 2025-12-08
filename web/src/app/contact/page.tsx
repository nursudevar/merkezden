"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import SearchBar from "@/components/SearchBar";
import { ContactAnimation } from "@/components/ContactAnimation";
import "@/styles/main.scss";
import "@/styles/pages/contact.scss";

export default function ContactPage() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form submit logic will be added later
  };

  return (
    <div className="contact-page">
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

      <main className="contact-page-main">
        <section className="contact-hero">
          <div className="contact-hero-icon">
            <ContactAnimation />
          </div>
          <h1 className="contact-hero-title"> Bizimle İletişime Geçin</h1>
          <p className="contact-hero-subtitle">
            Sorularınız, önerileriniz veya iş birliği talepleriniz için bize ulaşın. Ekibimiz size yardımcı olmaktan mutluluk duyar.
          </p>
        </section>

        <section className="contact-layout">
          <div className="contact-card contact-form-card">
            <h2 className="contact-card-title">Bize Mesaj Gönderin</h2>
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="fullName" className="contact-form-label">
                    Adınız Soyadınız
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    className="contact-form-input"
                    placeholder="Adınız Soyadınız"
                    required
                  />
                </div>
              </div>

              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="email" className="contact-form-label">
                    E-posta Adresiniz
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="contact-form-input"
                    placeholder="ornek@mail.com"
                    required
                  />
                </div>
              </div>

              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="subject" className="contact-form-label">
                    Konu
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    className="contact-form-input"
                    placeholder="Mesajınızın konusu"
                    required
                  />
                </div>
              </div>

              <div className="contact-form-row">
                <div className="contact-form-field">
                  <label htmlFor="message" className="contact-form-label">
                    Mesajınız
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    className="contact-form-textarea"
                    placeholder="Mesajınızı buraya yazın..."
                    rows={5}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="contact-submit-button">
                <svg className="contact-submit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                </svg>
                Mesaj Gönder
              </Button>
            </form>
          </div>

          <div className="contact-right-column">
            <div className="contact-card contact-info-card">
              <h2 className="contact-card-title">İletişim Bilgileri</h2>
              <div className="contact-info-list">
                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V8L12 13L20 8V18ZM12 11L4 6H20L12 11Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="contact-info-text">
                    <div className="contact-info-label">E-posta</div>
                    <div className="contact-info-value">destek@merkezden.com</div>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38L15.41 15.18C15.69 14.9 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C8.95 21 0 12.05 0 1C0 0.45 0.45 0 1 0H4.5C5.05 0 5.5 0.45 5.5 1C5.5 2.25 5.7 3.45 6.07 4.57C6.18 4.92 6.1 5.31 5.82 5.59L3.62 7.79Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="contact-info-text">
                    <div className="contact-info-label">Telefon</div>
                    <div className="contact-info-value">+90 (...) ... .. ..</div>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-info-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="contact-info-text">
                    <div className="contact-info-label">Adres</div>
                    <div className="contact-info-value">Ankara, Türkiye</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-card contact-map-card">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d385395.559009309!2d28.68253429999999!3d41.0053705!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14caa7040068086b%3A0x1d3c8e2e0b8b8b8b!2sIstanbul%2C%20Turkey!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                width="100%"
                height="240"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="İstanbul Haritası"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
