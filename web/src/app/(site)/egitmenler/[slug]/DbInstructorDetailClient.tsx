"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui";
import {
  MapPin,
  GraduationCap,
  CheckCircle2,
  Image as ImageIcon,
  BookOpen,
  Phone,
  Globe,
  Clock,
  X,
  Sparkles,
  Megaphone,
  CalendarDays,
  ImageOff,
  GitCommitVertical,
  Mail,
  Award,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  formatWorkingHoursRange,
  institutionTimeToInputHHMM,
} from "@/lib/institutionHelpers";
import {
  fetchPublicInstructorByParamClient,
  formatPublicInstructorDetailLocation,
  publicInstructorDisplayName,
  type PublicInstructorRow,
} from "@/lib/publicInstructorClient";
import {
  buildInstructorProfileSummaryLines,
  fetchPublicInstructorAnnouncementsClient,
  fetchPublicInstructorFeatureDisplayClient,
  fetchPublicInstructorGalleryClient,
  resolvePublicInstructorProfilePictureUrl,
  type PublicInstructorAnnouncementItem,
  type PublicInstructorFeatureLine,
  type PublicInstructorFeatureSection,
} from "@/lib/publicInstructorDetailClient";
import AnnouncementDetailModal, {
  type AnnouncementDetailItem,
} from "@/components/AnnouncementDetailModal";
import InstructorShareButton from "./InstructorShareButton";
import { getAnnouncementTagBadgeClassName } from "@/lib/announcementTags";
import CategoryBreadcrumb from "@/components/category/CategoryBreadcrumb";
import { toLocationIdString } from "@/lib/turkiyeLocationsClient";

type InstructorDetailTab = "about" | "features" | "announcements" | "gallery";
type InstructorDetailSpecialTab = "announcements" | null;

const EMPTY_TEXT = "Henüz içerik girilmedi.";

function instructorHeroText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const lower = text.toLocaleLowerCase("tr-TR");
  if (lower === "-" || lower === "null" || lower === "undefined") return "";
  return text;
}

function instructorHeroExperienceYears(value: unknown): number | null {
  if (value == null || value === "") return null;
  const years = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(years) || years <= 0) return null;
  return years;
}

export default function DbInstructorDetailClient({ slugOrId }: { slugOrId: string }) {
  const [row, setRow] = useState<PublicInstructorRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<InstructorDetailTab>("about");
  const [activeSpecialTab, setActiveSpecialTab] = useState<InstructorDetailSpecialTab>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<PublicInstructorAnnouncementItem[]>([]);
  const [profileLines, setProfileLines] = useState<PublicInstructorFeatureLine[]>([]);
  const [academicLines, setAcademicLines] = useState<PublicInstructorFeatureLine[]>([]);
  const [featureSections, setFeatureSections] = useState<PublicInstructorFeatureSection[]>([]);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementDetailItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { row: instructorRow, error: loadError } = await fetchPublicInstructorByParamClient(slugOrId);
      if (cancelled) return;
      if (loadError) {
        setRow(null);
        setError("Eğitmen profili yüklenirken bir hata oluştu.");
        setLoading(false);
        return;
      }
      if (!instructorRow) {
        setRow(null);
        setError("Eğitmen profili bulunamadı.");
        setLoading(false);
        return;
      }
      setRow(instructorRow);
      setProfileLines(buildInstructorProfileSummaryLines(instructorRow));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slugOrId]);

  useEffect(() => {
    if (!row?.id) {
      setGalleryUrls([]);
      setAnnouncements([]);
      setAcademicLines([]);
      setFeatureSections([]);
      return;
    }

    let cancelled = false;
    const instructorId = Number(row.id);

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [galleryRes, announcementsRes, featuresRes] = await Promise.all([
        fetchPublicInstructorGalleryClient(instructorId, supabase),
        fetchPublicInstructorAnnouncementsClient(instructorId, supabase),
        fetchPublicInstructorFeatureDisplayClient(instructorId, supabase),
      ]);

      if (cancelled) return;
      setGalleryUrls(galleryRes.items.map((i) => i.url));
      setAnnouncements(announcementsRes.items);
      setAcademicLines(featuresRes.academicLines);
      setFeatureSections(featuresRes.sections);
    })();

    return () => {
      cancelled = true;
    };
  }, [row?.id]);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [row?.profile_picture]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  const handleSectionTabClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string, tab: Exclude<InstructorDetailTab, "announcements">) => {
      event.preventDefault();
      setActiveSpecialTab(null);
      setActiveTab(tab);
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  const handleAnnouncementsTabClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setActiveSpecialTab("announcements");
    setActiveTab("announcements");
  }, []);

  useEffect(() => {
    if (activeSpecialTab !== "announcements") return;
    scrollToSection("announcements");
  }, [activeSpecialTab, scrollToSection]);

  const displayName = publicInstructorDisplayName(row);
  const shareKey = String(row?.slug ?? "").trim() || String(row?.id ?? slugOrId).trim();

  const photoUrl = useMemo(() => {
    if (!row) return "";
    return resolvePublicInstructorProfilePictureUrl(row.profile_picture);
  }, [row]);

  const location = formatPublicInstructorDetailLocation(row);
  const about = String(row?.about ?? row?.bio ?? "").trim();
  const school = instructorHeroText(row?.school);
  const department = instructorHeroText(row?.department);
  const educationLevel = instructorHeroText(row?.education_level);
  const experienceYears = instructorHeroExperienceYears(row?.experience_years);
  const hasHeroCredentials = Boolean(school || educationLevel || experienceYears != null);
  const email = String(row?.email ?? "").trim();
  const phone = String(row?.phone ?? "").trim();
  const website = String(row?.website ?? "").trim();
  const socialLinks = [
    { label: "Facebook", value: String(row?.facebook_url ?? "").trim() },
    { label: "Instagram", value: String(row?.instagram_url ?? "").trim() },
    { label: "X", value: String(row?.x_url ?? "").trim() },
    { label: "Linkedin", value: String(row?.linkedin_url ?? "").trim() },
  ].filter((item) => item.value);
  const address = String(row?.address ?? "").trim();
  const workingHoursStart = institutionTimeToInputHHMM(row?.working_hours_start);
  const workingHoursEnd = institutionTimeToInputHHMM(row?.working_hours_end);
  const workingHoursText = (() => {
    const range = formatWorkingHoursRange(row?.working_hours_start, row?.working_hours_end);
    if (range) return range.replace("-", " – ");
    if (workingHoursStart && workingHoursEnd) {
      return `${workingHoursStart} – ${workingHoursEnd}`;
    }
    if (workingHoursStart) return `Başlangıç: ${workingHoursStart}`;
    if (workingHoursEnd) return `Bitiş: ${workingHoursEnd}`;
    return null;
  })();
  const branch = String(row?.branch ?? "").trim();
  const categoryName = String(row?.category_name ?? "").trim();
  const hasPhoto = Boolean(photoUrl) && !photoLoadFailed;

  const mergedAcademicLines = useMemo(() => {
    const seen = new Set<string>();
    const lines: PublicInstructorFeatureLine[] = [];
    for (const line of profileLines) {
      const key = line.label.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
    for (const line of academicLines) {
      const key = line.label.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
    }
    return lines;
  }, [academicLines, profileLines]);

  const hasFeaturesContent = mergedAcademicLines.length > 0 || featureSections.length > 0;
  const hasAnnouncements = announcements.length > 0;
  const hasGallery = galleryUrls.length > 0;

  const renderInstructorSidebar = (className: string) => (
    <aside className={className}>
      <div className="instructor-sidebar-header">
        <Phone size={20} aria-hidden />
        <span>İletişim Bilgileri</span>
      </div>
      <div className="instructor-sidebar-body">
        <div className="instructor-map-preview">
          {hasPhoto ? (
            <Image
              src={photoUrl}
              alt={displayName}
              fill
              className="instructor-map-image"
              sizes="(max-width: 1024px) 100vw, 33vw"
              unoptimized
              onError={() => setPhotoLoadFailed(true)}
            />
          ) : (
            <div className="instructor-map-preview-empty">
              <GraduationCap size={40} aria-hidden />
            </div>
          )}
        </div>
        <div className="instructor-contact-list">
          {email ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <Mail size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">E-POSTA</div>
                <a href={`mailto:${email}`} className="instructor-contact-value instructor-contact-link">
                  {email}
                </a>
              </div>
            </div>
          ) : null}
          {location ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <MapPin size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">KONUM</div>
                <div className="instructor-contact-value">{location}</div>
              </div>
            </div>
          ) : null}
          {phone ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <Phone size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">TELEFON</div>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="instructor-contact-value instructor-contact-link">
                  {phone}
                </a>
              </div>
            </div>
          ) : null}
          {website ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <Globe size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">WEB SİTESİ</div>
                <a
                  href={website.startsWith("http") ? website : `https://${website}`}
                  className="instructor-contact-value instructor-contact-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {website}
                </a>
              </div>
            </div>
          ) : null}
          {socialLinks.length > 0 ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <Globe size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">SOSYAL MEDYA</div>
                <div className="instructor-contact-value">
                  {socialLinks.map((item, index) => (
                    <span key={item.label}>
                      {index > 0 ? " • " : ""}
                      <a
                        href={item.value.startsWith("http") ? item.value : `https://${item.value}`}
                        className="instructor-contact-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.label}
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {address ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <MapPin size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">ADRES</div>
                <div className="instructor-contact-value">{address}</div>
              </div>
            </div>
          ) : null}
          {workingHoursText ? (
            <div className="instructor-contact-item">
              <div className="instructor-contact-icon">
                <Clock size={18} aria-hidden />
              </div>
              <div>
                <div className="instructor-contact-label">ÇALIŞMA SAATLERİ</div>
                <div className="instructor-contact-value">{workingHoursText}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );

  const formatAnnouncementDateTr = useCallback((iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }, []);

  const buildAnnouncementExcerpt = useCallback((text: string, maxLen: number) => {
    const t = String(text ?? "").trim().replace(/\s+/g, " ");
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }, []);

  const renderAnnouncementsPanel = () => (
    <section id="announcements" className="instructor-section instructor-announcements-panel">
      <Card className="instructor-section-card instructor-announcements-card">
        <CardContent>
          <div className="instructor-features-head">
            <h2 className="instructor-section-title">Duyurular</h2>
          </div>
          {hasAnnouncements ? (
            <div className="instructor-announcements-list">
              {announcements.map((item) => {
                const trimmedLink = (item.linkUrl ?? "").trim();
                const hasLink = trimmedLink.length > 0;
                const absoluteLink = hasLink
                  ? /^https?:\/\//i.test(trimmedLink)
                    ? trimmedLink
                    : `https://${trimmedLink}`
                  : null;
                const linkLabel = hasLink
                  ? trimmedLink.replace(/^https?:\/\//i, "").replace(/^www\./i, "")
                  : "";

                return (
                  <article
                    key={item.id}
                    className="instructor-announcement-item"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setActiveAnnouncement({
                        id: item.id,
                        title: item.title,
                        content: item.content,
                        imageUrl: item.imageUrl,
                        createdAt: item.createdAt,
                        institutionName: displayName,
                        linkUrl: item.linkUrl,
                        announcementTag: item.announcementTag,
                        locationLabel: item.locationLabel,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveAnnouncement({
                          id: item.id,
                          title: item.title,
                          content: item.content,
                          imageUrl: item.imageUrl,
                          createdAt: item.createdAt,
                          institutionName: displayName,
                          linkUrl: item.linkUrl,
                          announcementTag: item.announcementTag,
                          locationLabel: item.locationLabel,
                        });
                      }
                    }}
                    aria-label={`${item.title} duyurusunu aç`}
                  >
                    <div
                      className={`instructor-announcement-thumb${
                        item.imageUrl ? "" : " instructor-announcement-thumb--empty"
                      }`}
                      aria-hidden
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt=""
                          fill
                          className="instructor-announcement-thumb-image"
                          sizes="72px"
                          unoptimized
                        />
                      ) : (
                        <ImageOff
                          className="instructor-announcement-thumb-icon"
                          size={28}
                          strokeWidth={1.25}
                        />
                      )}
                    </div>
                    <div className="instructor-announcement-body">
                      <div className="instructor-announcement-kicker">
                        {displayName.toLocaleUpperCase("tr-TR")}
                      </div>
                      {(() => {
                        const tag = String(item.announcementTag ?? "").trim();
                        const tagClass = getAnnouncementTagBadgeClassName(tag);
                        if (!tag || !tagClass) return null;
                        return <span className={tagClass}>{tag}</span>;
                      })()}
                      <h3 className="instructor-announcement-title">{item.title}</h3>
                      {item.content ? (
                        <p className="instructor-announcement-desc">
                          {buildAnnouncementExcerpt(item.content, 220)}
                        </p>
                      ) : null}
                      <div className="instructor-announcement-meta">
                        {item.createdAt ? (
                          <span className="instructor-announcement-meta-item">
                            <CalendarDays className="instructor-announcement-meta-icon" size={14} />
                            <span>{formatAnnouncementDateTr(item.createdAt)}</span>
                          </span>
                        ) : null}
                        {item.locationLabel ? (
                          <span className="instructor-announcement-meta-item">
                            <MapPin className="instructor-announcement-meta-icon" size={14} />
                            <span>{item.locationLabel}</span>
                          </span>
                        ) : null}
                        {hasLink && absoluteLink ? (
                          <a
                            href={absoluteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="instructor-announcement-meta-item instructor-announcement-meta-link"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Globe className="instructor-announcement-meta-icon" size={14} />
                            <span>{linkLabel}</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="instructor-features-empty">
              Bu eğitmene ait henüz duyuru bulunmuyor.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );

  if (loading) {
    return (
      <div className="instructor-detail-page">
        <div className="instructor-detail-container">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="instructor-detail-page">
        <div className="instructor-detail-container">
          <h1 className="instructor-name">Eğitmen Profili</h1>
          <p>{error || "Eğitmen profili bulunamadı."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-detail-page">
      <div className="instructor-detail-container">
        <CategoryBreadcrumb
          variant="instructor"
          categoryLabel={String(row.category_name ?? "").trim()}
          categoryHref="/egitmenler"
          listingPathname="/egitmenler"
          location={{
            ilId: toLocationIdString(row.il_id),
            ilceId: toLocationIdString(row.ilce_id),
            mahalleId: toLocationIdString(row.mahalle_id),
          }}
          currentLabel={displayName}
        />

        <Card className="instructor-hero">
          <CardContent className="instructor-hero-content">
            <div
              className={`instructor-hero-main${
                hasHeroCredentials ? " instructor-hero-main--with-credentials" : ""
              }`}
            >
              <div className="instructor-photo-section">
                <div className="instructor-photo-wrapper">
                  {hasPhoto ? (
                    <Image
                      src={photoUrl}
                      alt={displayName}
                      width={160}
                      height={160}
                      className="instructor-photo"
                      unoptimized
                      onError={() => setPhotoLoadFailed(true)}
                    />
                  ) : (
                    <div className="instructor-photo instructor-photo-fallback">
                      <GraduationCap size={56} aria-hidden />
                    </div>
                  )}
                </div>
              </div>

              <div className="instructor-info">
                <div className="instructor-title-row">
                  <h1 className="instructor-name">{displayName}</h1>
                </div>
                <div className="instructor-meta">
                  {branch ? (
                    <div className="instructor-meta-item">
                      <span className="instructor-meta-badge instructor-meta-badge--branch">
                        <GraduationCap size={16} aria-hidden />
                        {branch}
                      </span>
                    </div>
                  ) : null}
                  {categoryName ? (
                    <div className="instructor-meta-item">
                      <span className="instructor-meta-badge instructor-meta-badge--title">{categoryName}</span>
                    </div>
                  ) : null}
                  {location ? (
                    <div className="instructor-meta-item">
                      <MapPin size={18} aria-hidden />
                      <span>{location}</span>
                    </div>
                  ) : null}
                  {row.is_approved === true ? (
                    <div className="instructor-meta-item instructor-meta-verified">
                      <CheckCircle2 size={18} aria-hidden />
                      <span>Onaylı Eğitmen</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {hasHeroCredentials ? (
                <div className="instructor-hero-credentials">
                  {school ? (
                    <div className="instructor-hero-credential">
                      <div className="instructor-hero-credential-icon" aria-hidden>
                        <GraduationCap size={18} />
                      </div>
                      <div className="instructor-hero-credential-body">
                        <div className="instructor-hero-credential-label">Mezun Olunan Okul</div>
                        <div className="instructor-hero-credential-value">{school}</div>
                        {department ? (
                          <div className="instructor-hero-credential-secondary">{department}</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {educationLevel ? (
                    <div className="instructor-hero-credential">
                      <div className="instructor-hero-credential-icon" aria-hidden>
                        <Award size={18} />
                      </div>
                      <div className="instructor-hero-credential-body">
                        <div className="instructor-hero-credential-label">Eğitim Seviyesi</div>
                        <div className="instructor-hero-credential-value">{educationLevel}</div>
                      </div>
                    </div>
                  ) : null}
                  {experienceYears != null ? (
                    <div className="instructor-hero-credential">
                      <div className="instructor-hero-credential-icon" aria-hidden>
                        <Clock size={18} />
                      </div>
                      <div className="instructor-hero-credential-body">
                        <div className="instructor-hero-credential-label">Deneyim</div>
                        <div className="instructor-hero-credential-value">{experienceYears} yıl</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="instructor-actions">
                <InstructorShareButton slugOrId={shareKey} />
              </div>
            </div>
          </CardContent>
        </Card>

        {renderInstructorSidebar("instructor-sidebar instructor-sidebar--mobile")}

        <div className="instructor-tabs-sticky">
          <div className="instructor-tabs-list">
            <a
              href="#about"
              className={`instructor-tab-item${
                activeTab === "about" && activeSpecialTab !== "announcements"
                  ? " instructor-tab-active"
                  : ""
              }`}
              onClick={(e) => handleSectionTabClick(e, "about", "about")}
            >
              <BookOpen size={20} aria-hidden />
              <span>Hakkında</span>
            </a>
            <a
              href="#features"
              className={`instructor-tab-item${
                activeTab === "features" && activeSpecialTab !== "announcements"
                  ? " instructor-tab-active"
                  : ""
              }`}
              onClick={(e) => handleSectionTabClick(e, "features", "features")}
            >
              <Sparkles size={20} aria-hidden />
              <span>Eğitmen Özellikleri</span>
            </a>
            <a
              href="#announcements"
              className={`instructor-tab-item${
                activeTab === "announcements" && activeSpecialTab === "announcements"
                  ? " instructor-tab-active"
                  : ""
              }`}
              onClick={handleAnnouncementsTabClick}
              aria-current={activeSpecialTab === "announcements" ? "true" : undefined}
            >
              <Megaphone size={20} aria-hidden />
              <span>Duyurular</span>
            </a>
            {hasGallery ? (
              <a
                href="#gallery"
                className={`instructor-tab-item${
                  activeTab === "gallery" && activeSpecialTab !== "announcements"
                    ? " instructor-tab-active"
                    : ""
                }`}
                onClick={(e) => handleSectionTabClick(e, "gallery", "gallery")}
              >
                <ImageIcon size={20} aria-hidden />
                <span>Galeri</span>
              </a>
            ) : null}
          </div>
        </div>

        {activeSpecialTab === "announcements" ? renderAnnouncementsPanel() : null}

        <div className="instructor-content-grid">
          <div className="instructor-main-content">
            <section id="about" className="instructor-section">
              <h2 className="instructor-section-title">Hakkında</h2>
              <Card className="instructor-section-card">
                <CardContent>
                  <div className="instructor-about-text">
                    {(about || EMPTY_TEXT).split("\n\n").map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="features" className="instructor-section">
              <Card className="instructor-section-card instructor-features-card">
                <CardContent>
                  <div className="instructor-features-head">
                    <h2 className="instructor-section-title">Eğitmen Özellikleri</h2>
                  </div>
                  {hasFeaturesContent ? (
                    <div className="instructor-features-groups">
                      {mergedAcademicLines.length > 0 ? (
                        <div className="instructor-features-group">
                          <h3 className="instructor-features-group-title">Başlıca Özellikler</h3>
                          <div className="instructor-features-academic-list">
                            {mergedAcademicLines.map((line, lineIdx) => (
                              <div
                                key={`${line.label}-${lineIdx}`}
                                className="instructor-features-academic-row"
                              >
                                <span className="instructor-features-academic-icon" aria-hidden>
                                  <GitCommitVertical size={25} strokeWidth={2.2} />
                                </span>
                                <div className="instructor-features-academic-content">
                                  <span className="instructor-features-academic-label">{line.label}</span>
                                  <span className="instructor-features-academic-value">
                                    {Array.isArray(line.value) ? line.value.join(", ") : line.value}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {featureSections.map((section) => (
                        <div key={section.id} className="instructor-features-group">
                          <h3 className="instructor-features-group-title">{section.name}</h3>
                          <div className="instructor-features-badges">
                            {section.badges.map((badge) => (
                              <span key={`${section.id}-${badge}`} className="instructor-features-badge">
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="instructor-features-empty">{EMPTY_TEXT}</div>
                  )}
                </CardContent>
              </Card>
            </section>

            {hasGallery ? (
              <section id="gallery" className="instructor-section">
                <div className="instructor-section-header">
                  <h2 className="instructor-section-title">Galeri</h2>
                  <button
                    type="button"
                    className="instructor-section-link instructor-gallery-view-all-btn"
                    onClick={() => setIsGalleryModalOpen(true)}
                  >
                    tümünü gör
                  </button>
                </div>
                <div className="instructor-gallery-grid">
                  <div
                    className="instructor-gallery-item instructor-gallery-main"
                    onClick={() => setIsGalleryModalOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setIsGalleryModalOpen(true);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {galleryUrls[0] ? (
                      <Image
                        src={galleryUrls[0]}
                        alt={`${displayName} galeri`}
                        fill
                        className="instructor-gallery-image"
                        sizes="(max-width: 768px) 100vw, 66vw"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div
                    className="instructor-gallery-item instructor-gallery-side"
                    onClick={() => galleryUrls[1] && setIsGalleryModalOpen(true)}
                    role="button"
                    tabIndex={0}
                  >
                    {galleryUrls[1] ? (
                      <Image
                        src={galleryUrls[1]}
                        alt={`${displayName} galeri`}
                        fill
                        className="instructor-gallery-image"
                        sizes="33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="instructor-gallery-fallback">
                        <div className="instructor-gallery-fallback-icon">
                          <ImageIcon size={30} aria-hidden />
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    className="instructor-gallery-item instructor-gallery-side"
                    onClick={() => galleryUrls[2] && setIsGalleryModalOpen(true)}
                    role="button"
                    tabIndex={0}
                  >
                    {galleryUrls[2] ? (
                      <Image
                        src={galleryUrls[2]}
                        alt={`${displayName} galeri`}
                        fill
                        className="instructor-gallery-image"
                        sizes="33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="instructor-gallery-fallback">
                        <div className="instructor-gallery-fallback-icon">
                          <ImageIcon size={30} aria-hidden />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {renderInstructorSidebar("instructor-sidebar instructor-sidebar--desktop")}
        </div>

        <AnnouncementDetailModal
          isOpen={Boolean(activeAnnouncement)}
          onClose={() => setActiveAnnouncement(null)}
          announcement={activeAnnouncement}
        />

        {isGalleryModalOpen && hasGallery ? (
          <div
            className="instructor-gallery-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setIsGalleryModalOpen(false);
            }}
            role="presentation"
          >
            <div className="instructor-gallery-modal" role="dialog" aria-modal="true" aria-label="Eğitmen galerisi">
              <div className="instructor-gallery-modal-header">
                <div>
                  <h3 className="instructor-gallery-modal-title">Eğitmen Galerisi</h3>
                  <p className="instructor-gallery-modal-subtitle">{displayName}</p>
                </div>
                <button
                  type="button"
                  className="instructor-gallery-modal-close"
                  onClick={() => setIsGalleryModalOpen(false)}
                  aria-label="Kapat"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="instructor-gallery-modal-grid">
                {galleryUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="instructor-gallery-modal-item">
                    <Image
                      src={url}
                      alt={`${displayName} galeri ${index + 1}`}
                      fill
                      className="instructor-gallery-image"
                      sizes="240px"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
