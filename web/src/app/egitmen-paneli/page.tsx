"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Shapes,
  Images,
  Megaphone,
  Inbox,
  Settings,
  LogOut,
  FileText,
  CloudUpload,
  Image as ImageIcon,
  Plus,
  GraduationCap,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  resolveIndividualNameFromUsersClient,
  resolveUserTypeFromUsersClient,
  type AppUserType,
} from "@/lib/auth/authBrowserClient";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { Button, Input } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/egitmen-panel.scss";

type InstructorPanelTabId =
  | "overview"
  | "profile"
  | "features"
  | "media"
  | "announcements"
  | "applications"
  | "settings";

const INSTRUCTOR_PANEL_TABS: { id: InstructorPanelTabId; label: string }[] = [
  { id: "overview", label: "Genel Bakış" },
  { id: "profile", label: "Eğitmen Profili" },
  { id: "features", label: "Eğitmen Özellikleri" },
  { id: "media", label: "Fotoğraflar / CV" },
  { id: "announcements", label: "Duyurular" },
  { id: "applications", label: "Başvurular / İletişim Talepleri" },
  { id: "settings", label: "Ayarlar" },
];

const MOCK_STATS = {
  profileViews: 128,
  contactRequests: 7,
  activeAnnouncements: 2,
  profileStatus: "Taslak profil",
};

const MOCK_EXPERTISE_AREAS = [
  "Matematik",
  "Fizik",
  "İngilizce",
  "Müzik",
  "Resim",
  "Yazılım",
  "Robotik",
  "Satranç",
];

const MOCK_ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Yaz dönemi birebir ders programı",
    description: "Temmuz–Ağustos için online ve yüz yüze birebir ders slotları açılmıştır.",
    date: "12.05.2026",
  },
  {
    id: "2",
    title: "Ücretsiz deneme dersi",
    description: "Yeni öğrenciler için 45 dakikalık ücretsiz tanışma dersi.",
    date: "01.05.2026",
  },
];

const MOCK_APPLICATIONS = [
  {
    id: "1",
    fullName: "Ayşe Yılmaz",
    email: "ayse@ornek.com",
    phone: "0532 000 00 01",
    message: "Çocuğum için haftada 2 saat matematik dersi almak istiyorum.",
    date: "18.05.2026",
    status: "Yeni",
  },
  {
    id: "2",
    fullName: "Mehmet Kaya",
    email: "mehmet@ornek.com",
    phone: "0533 000 00 02",
    message: "Online İngilizce dersi fiyat bilgisi alabilir miyim?",
    date: "15.05.2026",
    status: "Okundu",
  },
  {
    id: "3",
    fullName: "Zeynep Demir",
    email: "zeynep@ornek.com",
    phone: "0534 000 00 03",
    message: "Grup dersi için yaş aralığı ve program hakkında bilgi rica ederim.",
    date: "10.05.2026",
    status: "Yanıtlandı",
  },
];

const INITIAL_PROFILE_FORM = {
  firstName: "Ayşe",
  lastName: "Öğretmen",
  email: "egitmen@ornek.com",
  phone: "0532 000 00 00",
  birthDate: "1990-05-15",
  tcIdentity: "",
  city: "Ankara",
  district: "Çankaya",
  address: "",
  bio: "",
  title: "Eğitmen",
  branch: "Matematik",
  experienceYears: "5",
  educationLevel: "Lisans",
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
};

export default function InstructorPanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<AppUserType | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [instructorName, setInstructorName] = useState("Eğitmen");
  const [activeTab, setActiveTab] = useState<InstructorPanelTabId>("overview");

  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);

  const [serviceTypes, setServiceTypes] = useState<string[]>(["Online", "Bireysel"]);
  const [lessonTypes, setLessonTypes] = useState<string[]>(["Birebir Ders"]);
  const [priceRange, setPriceRange] = useState("1000-5000 TL");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(["Matematik"]);
  const [ageGroups, setAgeGroups] = useState<string[]>(["Çocuk", "Genç"]);

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementDescription, setAnnouncementDescription] = useState("");
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);

  const [settingsEmail, setSettingsEmail] = useState("egitmen@ornek.com");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [settingsPasswordConfirm, setSettingsPasswordConfirm] = useState("");
  const [profileVisible, setProfileVisible] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setIsAuthReady(true);
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || user !== null) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) setUser({ id: session.user.id, email: session.user.email });
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setRoleLoaded(false);
      setUserType(null);
      return;
    }
    let cancelled = false;
    setRoleLoaded(false);
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) {
        setUserType(type);
        setRoleLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || userType !== "instructor") {
      setInstructorName("Eğitmen");
      return;
    }
    let cancelled = false;
    resolveIndividualNameFromUsersClient(user.id).then((name) => {
      if (!cancelled) setInstructorName(name || "Eğitmen");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (user?.email) setSettingsEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!isAuthReady || !user || !roleLoaded) return;
    if (userType !== "instructor") {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, router]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleProfileSave = () => {
    console.log("[instructor-panel] profile save (mock)", profileForm);
    setProfileSaveMessage("Değişiklikler kaydedildi (önizleme).");
    window.setTimeout(() => setProfileSaveMessage(null), 3000);
  };

  const handleFeaturesSave = () => {
    console.log("[instructor-panel] features save (mock)", {
      serviceTypes,
      lessonTypes,
      priceRange,
      expertiseAreas,
      ageGroups,
    });
  };

  const toggleInArray = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleAddAnnouncement = () => {
    const title = announcementTitle.trim();
    const description = announcementDescription.trim();
    if (!title || !description) return;
    const next = {
      id: String(Date.now()),
      title,
      description,
      date: new Date().toLocaleDateString("tr-TR"),
    };
    setAnnouncements((prev) => [next, ...prev]);
    setAnnouncementTitle("");
    setAnnouncementDescription("");
    console.log("[instructor-panel] announcement add (mock)", next);
  };

  const handleSettingsSave = () => {
    console.log("[instructor-panel] settings save (mock)", {
      settingsEmail,
      profileVisible,
      passwordChanged: Boolean(settingsPassword),
    });
  };

  const handlePassiveAccount = () => {
    console.log("[instructor-panel] passive account (mock)");
  };

  const handleMockFileSelect = useCallback((label: string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) console.log(`[instructor-panel] ${label} selected (mock):`, file.name);
    };
  }, []);

  const sidebarIcons: Record<InstructorPanelTabId, React.ReactNode> = {
    overview: <LayoutDashboard className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    profile: <User className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    features: <Shapes className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    media: <Images className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    announcements: <Megaphone className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    applications: <Inbox className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
    settings: <Settings className="egitmen-panel-sidebar-nav-icon" aria-hidden />,
  };

  const activeTabConfig =
    INSTRUCTOR_PANEL_TABS.find((t) => t.id === activeTab) ?? INSTRUCTOR_PANEL_TABS[0];

  if (!isAuthReady || (user && !roleLoaded)) {
    return (
      <div className="egitmen-panel-page">
        <HeaderClientWrapper />
        <div className="egitmen-panel-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (userType !== "instructor") return null;

  const isOverview = activeTab === "overview";
  const isProfile = activeTab === "profile";
  const isFeatures = activeTab === "features";
  const isMedia = activeTab === "media";
  const isAnnouncements = activeTab === "announcements";
  const isApplications = activeTab === "applications";
  const isSettings = activeTab === "settings";

  return (
    <div className="egitmen-panel-page">
      <HeaderClientWrapper />
      <div className="egitmen-panel-page-container">
        <aside className="egitmen-panel-sidebar">
          <div className="egitmen-panel-sidebar-content">
            <div className="egitmen-panel-sidebar-profile">
              <div className="egitmen-panel-sidebar-avatar-wrap">
                <div className="egitmen-panel-sidebar-avatar">
                  <GraduationCap className="egitmen-panel-sidebar-avatar-icon" aria-hidden />
                </div>
              </div>
              <h2 className="egitmen-panel-sidebar-name">{instructorName}</h2>
              <p className="egitmen-panel-sidebar-role">Eğitmen Hesabı</p>
            </div>
            <nav className="egitmen-panel-sidebar-nav" aria-label="Eğitmen paneli menüsü">
              {INSTRUCTOR_PANEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`egitmen-panel-sidebar-nav-item ${activeTab === tab.id ? "egitmen-panel-sidebar-nav-item--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                >
                  {sidebarIcons[tab.id]}
                  <span>{tab.label}</span>
                </button>
              ))}
              <button
                type="button"
                className="egitmen-panel-sidebar-nav-item egitmen-panel-sidebar-nav-item--logout"
                onClick={() => void handleLogout()}
              >
                <LogOut className="egitmen-panel-sidebar-nav-icon" aria-hidden />
                <span>Çıkış Yap</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="egitmen-panel-page-main">
          <section
            className={
              isOverview
                ? "egitmen-panel-main-card egitmen-panel-overview-card"
                : isProfile
                  ? "egitmen-panel-main-card egitmen-panel-profile-card"
                  : "egitmen-panel-main-card"
            }
            aria-labelledby={isOverview ? "instructor-overview-title" : "instructor-card-title"}
          >
            {isOverview ? (
              <>
                <div className="egitmen-panel-overview-header">
                  <h2 id="instructor-overview-title" className="egitmen-panel-overview-title">
                    Genel Bakış
                  </h2>
                  <p className="egitmen-panel-overview-subtitle">Eğitmen paneli özetiniz ve kısa rehber.</p>
                </div>
                <div className="egitmen-panel-overview-content">
                  <div className="egitmen-panel-overview-box">
                    <h3 className="egitmen-panel-overview-box-title">Hoş Geldiniz</h3>
                    <div className="egitmen-panel-overview-box-body">
                      <p>Merhaba, eğitmen panelinize hoş geldiniz.</p>
                    </div>
                  </div>
                  <div className="egitmen-panel-overview-metrics">
                    <div className="egitmen-panel-overview-stats">
                      <div className="egitmen-panel-stat-card">
                        <div className="egitmen-panel-stat-card-body">
                          <span className="egitmen-panel-stat-card-label">PROFİL</span>
                          <h3 className="egitmen-panel-stat-card-heading">Profil Görüntülenme</h3>
                          <p className="egitmen-panel-stat-card-desc">Son 30 gün (örnek veri).</p>
                        </div>
                        <div className="egitmen-panel-stat-card-value-wrap" aria-live="polite">
                          <span className="egitmen-panel-stat-card-value">
                            {MOCK_STATS.profileViews}
                          </span>
                        </div>
                      </div>
                      <div className="egitmen-panel-stat-card">
                        <div className="egitmen-panel-stat-card-body">
                          <span className="egitmen-panel-stat-card-label">İLETİŞİM</span>
                          <h3 className="egitmen-panel-stat-card-heading">Gelen İletişim Talepleri</h3>
                          <p className="egitmen-panel-stat-card-desc">Bekleyen ve yeni talepler.</p>
                        </div>
                        <div className="egitmen-panel-stat-card-value-wrap">
                          <span className="egitmen-panel-stat-card-value">
                            {MOCK_STATS.contactRequests}
                          </span>
                        </div>
                      </div>
                      <div className="egitmen-panel-stat-card">
                        <div className="egitmen-panel-stat-card-body">
                          <span className="egitmen-panel-stat-card-label">DUYURU</span>
                          <h3 className="egitmen-panel-stat-card-heading">Aktif Duyurular</h3>
                          <p className="egitmen-panel-stat-card-desc">Yayında olan duyuru sayısı.</p>
                        </div>
                        <div className="egitmen-panel-stat-card-value-wrap">
                          <span className="egitmen-panel-stat-card-value">
                            {MOCK_STATS.activeAnnouncements}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="egitmen-panel-status-card">
                      <div className="egitmen-panel-status-card-main">
                        <span className="egitmen-panel-status-card-label">DURUM</span>
                        <h3 className="egitmen-panel-status-card-heading">Profil Durumu</h3>
                      </div>
                      <p className="egitmen-panel-status-card-value">{MOCK_STATS.profileStatus}</p>
                      <p className="egitmen-panel-status-card-desc">
                        Onay bekliyor veya taslak olarak görüntülenebilir.
                      </p>
                    </div>
                  </div>
                  <div className="egitmen-panel-overview-box">
                    <h3 className="egitmen-panel-overview-box-title">Rehber</h3>
                    <div className="egitmen-panel-overview-box-body">
                      <p>
                        Profilinizi tamamlayarak öğrencilerin sizi daha kolay bulmasını sağlayabilirsiniz.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="egitmen-panel-main-card-header">
                  <div className="egitmen-panel-main-card-header-left">
                    {isProfile ? <User className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isFeatures ? <Shapes className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isMedia ? <Images className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isAnnouncements ? <Megaphone className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isApplications ? <Inbox className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    {isSettings ? <Settings className="egitmen-panel-main-card-icon" aria-hidden /> : null}
                    <h2 id="instructor-card-title" className="egitmen-panel-main-card-title">
                      {activeTabConfig.label}
                    </h2>
                  </div>
                  {isProfile ? (
                    <Button
                      type="button"
                      variant="default"
                      className="egitmen-panel-save-btn"
                      onClick={handleProfileSave}
                    >
                      Değişiklikleri Kaydet
                    </Button>
                  ) : null}
                  {isFeatures ? (
                    <Button
                      type="button"
                      variant="default"
                      className="egitmen-panel-save-btn"
                      onClick={handleFeaturesSave}
                    >
                      Kaydet
                    </Button>
                  ) : null}
                </div>

                {isProfile ? (
                  <div className="egitmen-panel-card-content">
                    {profileSaveMessage ? (
                      <p className="egitmen-panel-save-message">{profileSaveMessage}</p>
                    ) : null}
                    <div className="egitmen-panel-form">
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Ad</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.firstName}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, firstName: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Soyad</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.lastName}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, lastName: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">E-posta</label>
                          <Input
                            type="email"
                            className="egitmen-panel-form-input"
                            value={profileForm.email}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, email: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Telefon</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.phone}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, phone: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Doğum Tarihi</label>
                          <Input
                            type="date"
                            className="egitmen-panel-form-input"
                            value={profileForm.birthDate}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, birthDate: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">TC Kimlik No</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.tcIdentity}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, tcIdentity: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Şehir</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.city}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, city: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">İlçe</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.district}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, district: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Adres</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.address}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, address: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row egitmen-panel-form-row--full">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Kısa Biyografi</label>
                          <textarea
                            className="egitmen-panel-form-textarea"
                            rows={4}
                            value={profileForm.bio}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, bio: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Ünvan</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.title}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, title: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Branş</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.branch}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, branch: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Deneyim Yılı</label>
                          <Input
                            type="number"
                            min={0}
                            className="egitmen-panel-form-input"
                            value={profileForm.experienceYears}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, experienceYears: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Eğitim Seviyesi</label>
                          <Input
                            className="egitmen-panel-form-input"
                            value={profileForm.educationLevel}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, educationLevel: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="egitmen-panel-form-row">
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Çalışma Saati Başlangıç</label>
                          <Input
                            type="time"
                            className="egitmen-panel-form-input"
                            value={profileForm.workingHoursStart}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, workingHoursStart: e.target.value }))
                            }
                          />
                        </div>
                        <div className="egitmen-panel-form-field">
                          <label className="egitmen-panel-form-label">Çalışma Saati Bitiş</label>
                          <Input
                            type="time"
                            className="egitmen-panel-form-input"
                            value={profileForm.workingHoursEnd}
                            onChange={(e) =>
                              setProfileForm((p) => ({ ...p, workingHoursEnd: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isFeatures ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Hizmet Tipi</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Online", "Yüz yüze", "Bireysel", "Grup"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={serviceTypes.includes(opt)}
                              onChange={() => toggleInArray(opt, serviceTypes, setServiceTypes)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Ders Türü</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Birebir Ders", "Grup Dersi", "Online Eğitim", "Atölye"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={lessonTypes.includes(opt)}
                              onChange={() => toggleInArray(opt, lessonTypes, setLessonTypes)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Fiyat Aralığı</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["0-1000 TL", "1000-5000 TL", "5000-10000 TL", "10000 TL+"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="radio"
                              name="price-range"
                              checked={priceRange === opt}
                              onChange={() => setPriceRange(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Uzmanlık Alanları</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {MOCK_EXPERTISE_AREAS.map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={expertiseAreas.includes(opt)}
                              onChange={() => toggleInArray(opt, expertiseAreas, setExpertiseAreas)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Yaş Grubu</h3>
                      <div className="egitmen-panel-options-grid egitmen-panel-options-grid--selection">
                        {["Çocuk", "Genç", "Yetişkin"].map((opt) => (
                          <label key={opt} className="egitmen-panel-option-check">
                            <input
                              type="checkbox"
                              checked={ageGroups.includes(opt)}
                              onChange={() => toggleInArray(opt, ageGroups, setAgeGroups)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isMedia ? (
                  <div className="egitmen-panel-media">
                    <p className="egitmen-panel-media-desc">
                      Profil fotoğrafı, galeri görselleri ve CV dosyanızı buradan yükleyebilirsiniz. (Önizleme
                      modu — dosyalar kaydedilmez.)
                    </p>
                    <div className="egitmen-panel-media-upload-grid">
                      <div className="egitmen-panel-media-upload-card">
                        <div className="egitmen-panel-media-upload-head">
                          <div className="egitmen-panel-media-upload-head-text">
                            <h4 className="egitmen-panel-media-upload-title">Profil Fotoğrafı</h4>
                            <p className="egitmen-panel-media-upload-subtitle">PNG, JPG veya WEBP</p>
                          </div>
                          <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
                            <User className="egitmen-panel-media-upload-icon" />
                          </div>
                        </div>
                        <label className="egitmen-panel-dropzone">
                          <input type="file" accept="image/*" onChange={handleMockFileSelect("profile-photo")} />
                          <div className="egitmen-panel-dropzone-inner">
                            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                            <p className="egitmen-panel-dropzone-title">Dosyayı seçin veya sürükleyin</p>
                          </div>
                        </label>
                      </div>
                      <div className="egitmen-panel-media-upload-card">
                        <div className="egitmen-panel-media-upload-head">
                          <div className="egitmen-panel-media-upload-head-text">
                            <h4 className="egitmen-panel-media-upload-title">Galeri Görselleri</h4>
                            <p className="egitmen-panel-media-upload-subtitle">Birden fazla görsel ekleyebilirsiniz</p>
                          </div>
                          <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
                            <ImageIcon className="egitmen-panel-media-upload-icon" />
                          </div>
                        </div>
                        <label className="egitmen-panel-dropzone">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleMockFileSelect("gallery")}
                          />
                          <div className="egitmen-panel-dropzone-inner">
                            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                            <p className="egitmen-panel-dropzone-title">Galeri için görsel seçin</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div className="egitmen-panel-media-upload-card egitmen-panel-media-cv-block">
                      <div className="egitmen-panel-media-upload-head">
                        <div className="egitmen-panel-media-upload-head-text">
                          <h4 className="egitmen-panel-media-upload-title">CV Yükle</h4>
                          <p className="egitmen-panel-media-upload-subtitle">PDF, DOC veya DOCX</p>
                        </div>
                        <div className="egitmen-panel-media-upload-icon-wrap" aria-hidden>
                          <FileText className="egitmen-panel-media-upload-icon" />
                        </div>
                      </div>
                      <label className="egitmen-panel-dropzone">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword"
                          onChange={handleMockFileSelect("cv")}
                        />
                        <div className="egitmen-panel-dropzone-inner">
                          <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                          <p className="egitmen-panel-dropzone-title">CV dosyanızı yükleyin</p>
                          <p className="egitmen-panel-dropzone-subtitle">
                            Kabul edilen formatlar: PDF, DOC, DOCX
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : null}

                {isAnnouncements ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Yeni Duyuru</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Duyuru Başlığı</label>
                        <Input
                          className="egitmen-panel-form-input"
                          value={announcementTitle}
                          onChange={(e) => setAnnouncementTitle(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Açıklama</label>
                        <textarea
                          className="egitmen-panel-form-textarea"
                          rows={4}
                          value={announcementDescription}
                          onChange={(e) => setAnnouncementDescription(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-media-upload-card egitmen-panel-announcement-upload">
                        <label className="egitmen-panel-dropzone">
                          <input type="file" accept="image/*" onChange={handleMockFileSelect("announcement-image")} />
                          <div className="egitmen-panel-dropzone-inner">
                            <CloudUpload className="egitmen-panel-dropzone-icon" aria-hidden />
                            <p className="egitmen-panel-dropzone-title">Duyuru görseli (isteğe bağlı)</p>
                          </div>
                        </label>
                      </div>
                      <div className="egitmen-panel-form-actions">
                      <Button
                        type="button"
                        variant="default"
                        className="egitmen-panel-add-btn"
                        onClick={handleAddAnnouncement}
                      >
                        <Plus className="egitmen-panel-add-btn-icon" aria-hidden />
                        Duyuru Ekle
                      </Button>
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Duyurularım</h3>
                      <div className="egitmen-panel-announcement-list">
                      {announcements.map((item) => (
                        <article
                          key={item.id}
                          className="egitmen-panel-announcement-item"
                        >
                          <div className="egitmen-panel-announcement-item-body">
                            <span className="egitmen-panel-announcement-item-title">{item.title}</span>
                            <p className="egitmen-panel-announcement-item-desc">{item.description}</p>
                            <span className="egitmen-panel-badge">{item.date}</span>
                          </div>
                        </article>
                      ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isApplications ? (
                  <div className="egitmen-panel-table-content">
                    <div className="egitmen-panel-table-wrap">
                      <table className="egitmen-panel-table">
                        <thead>
                          <tr>
                            <th className="egitmen-panel-th">Ad Soyad</th>
                            <th className="egitmen-panel-th">E-posta</th>
                            <th className="egitmen-panel-th">Telefon</th>
                            <th className="egitmen-panel-th">Mesaj</th>
                            <th className="egitmen-panel-th">Tarih</th>
                            <th className="egitmen-panel-th">Durum</th>
                            <th className="egitmen-panel-th egitmen-panel-th--actions">İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_APPLICATIONS.map((row) => (
                            <tr key={row.id} className="egitmen-panel-tr">
                              <td className="egitmen-panel-td egitmen-panel-td--title">{row.fullName}</td>
                              <td className="egitmen-panel-td">{row.email}</td>
                              <td className="egitmen-panel-td">{row.phone}</td>
                              <td className="egitmen-panel-td egitmen-panel-td--desc">
                                <span className="egitmen-panel-desc-clamp">{row.message}</span>
                              </td>
                              <td className="egitmen-panel-td">{row.date}</td>
                              <td className="egitmen-panel-td">
                                <span className="egitmen-panel-badge">{row.status}</span>
                              </td>
                              <td className="egitmen-panel-td egitmen-panel-td--actions">
                                <Button
                                  type="button"
                                  variant="default"
                                  className="egitmen-panel-table-action-btn"
                                  onClick={() =>
                                    console.log("[instructor-panel] application detail (mock)", row.id)
                                  }
                                >
                                  Detay
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {isSettings ? (
                  <div className="egitmen-panel-tab-content">
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Hesap</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Hesap E-postası</label>
                        <Input
                          type="email"
                          className="egitmen-panel-form-input"
                          value={settingsEmail}
                          onChange={(e) => setSettingsEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Şifre Değiştir</h3>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Yeni Şifre</label>
                        <Input
                          type="password"
                          className="egitmen-panel-form-input"
                          value={settingsPassword}
                          onChange={(e) => setSettingsPassword(e.target.value)}
                        />
                      </div>
                      <div className="egitmen-panel-form-field">
                        <label className="egitmen-panel-form-label">Yeni Şifre (Tekrar)</label>
                        <Input
                          type="password"
                          className="egitmen-panel-form-input"
                          value={settingsPasswordConfirm}
                          onChange={(e) => setSettingsPasswordConfirm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="egitmen-panel-section">
                      <h3 className="egitmen-panel-section-title">Profil Görünürlüğü</h3>
                      <label className="egitmen-panel-option-check">
                        <input
                          type="checkbox"
                          checked={profileVisible}
                          onChange={(e) => setProfileVisible(e.target.checked)}
                        />
                        <span>Profilim arama sonuçlarında görünsün</span>
                      </label>
                    </div>
                    <div className="egitmen-panel-settings-actions">
                      <Button
                        type="button"
                        variant="default"
                        className="egitmen-panel-save-btn"
                        onClick={handleSettingsSave}
                      >
                        Ayarları Kaydet
                      </Button>
                      <Button type="button" variant="outline" onClick={handlePassiveAccount}>
                        Hesabı Pasife Al
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
