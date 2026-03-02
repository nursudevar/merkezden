"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Building,
  Megaphone,
  CreditCard,
  Inbox,
  PencilLine,
  Trash2,
  Plus,
  CheckCircle,
  Info,
  Star,
  Upload,
  Loader2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolveUserTypeFromUsersClient } from "@/lib/auth/resolveUserTypeFromUsersClient";
import { resolveInstitutionNameFromUsersClient } from "@/lib/auth/resolveInstitutionNameFromUsersClient";
import HeaderClientWrapper from "@/components/layout/HeaderClientWrapper";
import { Button, Input } from "@/components/ui";
import "@/styles/main.scss";
import "@/styles/pages/panel.scss";

type PanelTabId =
  | "overview"
  | "institution-profile"
  | "institutions"
  | "announcements"
  | "subscription"
  | "requests";

const PANEL_TABS: { id: PanelTabId; label: string; placeholder: string }[] = [
  { id: "overview", label: "Genel Bakış", placeholder: "Özet metrikler burada görünecek." },
  {
    id: "institution-profile",
    label: "Kurum Profili",
    placeholder: "Kurum profil bilgileri burada yönetilecek.",
  },
  {
    id: "institutions",
    label: "Kurumlar",
    placeholder: "Kurum ekleme/çıkarma burada yapılacak.",
  },
  {
    id: "announcements",
    label: "Duyurular",
    placeholder: "Duyurular ve içerikler burada yönetilecek.",
  },
  {
    id: "subscription",
    label: "Abonelik",
    placeholder: "Plan ve faturalandırma burada yönetilecek.",
  },
  { id: "requests", label: "Talepler", placeholder: "Gelen talepler burada listelenecek." },
];

export default function PanelPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userType, setUserType] = useState<"individual" | "institution" | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTabId>("overview");
  const [institutionName, setInstitutionName] = useState<string>("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingInstitutionProfile, setIsEditingInstitutionProfile] = useState(false);
  const [institutionFormData, setInstitutionFormData] = useState({
    institutionName: "",
    email: "",
    phone: "",
    website: "",
    city: "",
    district: "",
    address: "",
    about: "",
    logoUrl: "",
  });

  type AnnouncementStatus = "draft" | "published";
  interface AnnouncementRow {
    id: string;
    title: string;
    content: string;
    date: string;
    status: AnnouncementStatus;
  }

  const [announcementsList, setAnnouncementsList] = useState<AnnouncementRow[]>([
    {
      id: "a1",
      title: "Örnek Duyuru",
      content: "Bu duyuru metni örnek olarak gösterilmektedir. İçerik burada yer alır.",
      date: "15.01.2025",
      status: "published",
    },
    {
      id: "a2",
      title: "Taslak Başlık",
      content: "Henüz yayına alınmamış taslak içerik.",
      date: "—",
      status: "draft",
    },
  ]);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    status: "draft" as AnnouncementStatus,
  });
  const [announcementFormErrors, setAnnouncementFormErrors] = useState<{ title?: string; content?: string }>({});

  type RequestStatus = "pending" | "approved" | "rejected";
  type RequestStatusFilter = "all" | "pending" | "approved" | "rejected";
  interface RequestRow {
    id: string;
    type: string;
    institutionName: string;
    createdAt: string;
    status: RequestStatus;
    description: string;
    adminNote: string;
    updatedAt: string;
  }

  const REQUESTS_MOCK: RequestRow[] = [
    {
      id: "r1",
      type: "Kurum Oluşturma",
      institutionName: "Örnek Kurum A.Ş.",
      createdAt: "10.01.2025",
      status: "approved",
      description: "Yeni kurum kaydı oluşturulması talebi.",
      adminNote: "İnceleme tamamlandı, onaylandı.",
      updatedAt: "12.01.2025",
    },
    {
      id: "r2",
      type: "Profil Güncelleme",
      institutionName: "Demo Eğitim Merkezi",
      createdAt: "05.02.2025",
      status: "pending",
      description: "Kurum iletişim bilgilerinin güncellenmesi.",
      adminNote: "",
      updatedAt: "05.02.2025",
    },
    {
      id: "r3",
      type: "Duyuru Yayınlama",
      institutionName: "Örnek Kurum A.Ş.",
      createdAt: "28.01.2025",
      status: "rejected",
      description: "Duyuru metninin yayına alınması talebi.",
      adminNote: "İçerik kurallara uygun değildir.",
      updatedAt: "30.01.2025",
    },
  ];

  const [requestsList] = useState<RequestRow[]>(REQUESTS_MOCK);
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>("all");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id } : null);
      setIsAuthReady(true);
    }

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) {
        setUserType(null);
        setRoleLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || user !== null) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) setUser({ id: session.user.id });
      else router.replace("/login");
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user, router]);

  useEffect(() => {
    if (!user?.id) {
      setRoleLoaded(false);
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
    if (!user?.id || userType !== "institution") return;
    let cancelled = false;
    resolveInstitutionNameFromUsersClient(user.id).then((name) => {
      if (!cancelled) setInstitutionName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "institution") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("institutions")
      .select("id, institution_name, logo")
      .eq("owner_auth_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const row = data as { id: number; institution_name?: string; logo?: string | null } | null;
        if (row) {
          setInstitutionId(String(row.id));
          const logoUrl = row.logo
            ? supabase.storage.from("institution-logos").getPublicUrl(row.logo).data.publicUrl
            : "";
          setInstitutionFormData((prev) => ({ ...prev, logoUrl }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!isAuthReady || !user || !roleLoaded) return;
    if (userType !== "institution") {
      router.replace("/");
    }
  }, [isAuthReady, user, roleLoaded, userType, router]);

  useEffect(() => {
    if (!announcementModalOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnnouncementModalOpen(false);
        setEditingAnnouncementId(null);
        setAnnouncementFormErrors({});
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [announcementModalOpen]);

  if (!isAuthReady || (user && !roleLoaded)) {
    return (
      <div className="panel-page">
        <HeaderClientWrapper />
        <div className="panel-page-loading">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (userType !== "institution") return null;

  const activeTabConfig = PANEL_TABS.find((t) => t.id === activeTab) ?? PANEL_TABS[0];

  const sidebarIcons: Record<PanelTabId, React.ReactNode> = {
    overview: <LayoutDashboard className="panel-sidebar-nav-icon" aria-hidden />,
    "institution-profile": <Building2 className="panel-sidebar-nav-icon" aria-hidden />,
    institutions: <Building className="panel-sidebar-nav-icon" aria-hidden />,
    announcements: <Megaphone className="panel-sidebar-nav-icon" aria-hidden />,
    subscription: <CreditCard className="panel-sidebar-nav-icon" aria-hidden />,
    requests: <Inbox className="panel-sidebar-nav-icon" aria-hidden />,
  };

  const handleInstitutionFormChange = (field: keyof typeof institutionFormData, value: string) => {
    setInstitutionFormData((prev) => ({ ...prev, [field]: value }));
  };

  const ALLOWED_LOGO_TYPES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setLogoUploadError(null);
    if (!file) return;
    const ext = ALLOWED_LOGO_TYPES[file.type];
    if (!ext) {
      setLogoUploadError("Sadece PNG, JPG veya WebP yükleyebilirsiniz.");
      return;
    }
    if (!institutionId) {
      setLogoUploadError("Kurum kaydı bulunamadı.");
      return;
    }
    setLogoUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `institutions/${institutionId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("institution-logos")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setLogoUploading(false);
      setLogoUploadError(uploadError.message || "Yükleme başarısız.");
      return;
    }
    const { error: updateError } = await supabase
      .from("institutions")
      .update({ logo: path })
      .eq("id", Number(institutionId));
    if (updateError) {
      setLogoUploading(false);
      setLogoUploadError(updateError.message || "Kayıt güncellenemedi.");
      return;
    }
    const publicUrl = supabase.storage.from("institution-logos").getPublicUrl(path).data.publicUrl;
    setInstitutionFormData((prev) => ({ ...prev, logoUrl: publicUrl }));
    setLogoUploading(false);
  };

  const handleInstitutionProfileSave = () => {
    setIsEditingInstitutionProfile(false);
  };

  const isInstitutionProfileTab = activeTab === "institution-profile";
  const isAnnouncementsTab = activeTab === "announcements";
  const isRequestsTab = activeTab === "requests";
  const isOverviewTab = activeTab === "overview";

  const OVERVIEW_ANNOUNCEMENTS = [
    {
      id: "o1",
      title: "Sistem Bakım Çalışması Hakkında",
      description: "24 Mayıs 2024 tarihinde saat 02:00 - 04:00 arasında planlı bakım çalışması gerçekleştirilecektir.",
      timeLabel: "2 Saat Önce",
      icon: Megaphone,
      iconBg: "orange",
    },
    {
      id: "o2",
      title: "Yeni Şube Kayıt Özelliği Aktif Edildi",
      description: "Artık panel üzerinden birden fazla şubenizi tek bir hesapla kolayca yönetebilirsiniz.",
      timeLabel: "Dün",
      icon: Info,
      iconBg: "blue",
    },
    {
      id: "o3",
      title: "Aylık Performans Raporu Yayınlandı",
      description: "Nisan ayı kurum içi büyüme ve kullanıcı etkileşim verilerini içeren raporunuz hazır.",
      timeLabel: "2 Gün Önce",
      icon: Star,
      iconBg: "purple",
    },
  ];

  const filteredRequests = requestsList.filter((r) => {
    if (requestStatusFilter === "all") return true;
    return r.status === requestStatusFilter;
  });

  const toggleRequestDetail = (id: string) => {
    setExpandedRequestId((prev) => (prev === id ? null : id));
  };

  const openNewAnnouncementModal = () => {
    setEditingAnnouncementId(null);
    setAnnouncementForm({ title: "", content: "", status: "draft" });
    setAnnouncementFormErrors({});
    setAnnouncementModalOpen(true);
  };

  const openEditAnnouncementModal = (item: AnnouncementRow) => {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      status: item.status,
    });
    setAnnouncementFormErrors({});
    setAnnouncementModalOpen(true);
  };

  const closeAnnouncementModal = () => {
    setAnnouncementModalOpen(false);
    setEditingAnnouncementId(null);
    setAnnouncementFormErrors({});
  };

  const handleAnnouncementFormChange = (
    field: keyof typeof announcementForm,
    value: string | AnnouncementStatus
  ) => {
    setAnnouncementForm((prev) => ({ ...prev, [field]: value }));
    setAnnouncementFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleAnnouncementSave = () => {
    const title = announcementForm.title.trim();
    const content = announcementForm.content.trim();
    const errors: { title?: string; content?: string } = {};
    if (!title) errors.title = "Başlık zorunludur.";
    if (!content) errors.content = "İçerik zorunludur.";
    if (Object.keys(errors).length > 0) {
      setAnnouncementFormErrors(errors);
      return;
    }
    if (editingAnnouncementId) {
      setAnnouncementsList((prev) =>
        prev.map((row) =>
          row.id === editingAnnouncementId
            ? { ...row, title, content, status: announcementForm.status }
            : row
        )
      );
    } else {
      setAnnouncementsList((prev) => [
        {
          id: String(Date.now()),
          title,
          content,
          date: "—",
          status: announcementForm.status,
        },
        ...prev,
      ]);
    }
    closeAnnouncementModal();
  };

  const handleAnnouncementDelete = (id: string) => {
    setAnnouncementsList((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <div className="panel-page">
      <HeaderClientWrapper />
      <div className="panel-page-container">
        <header className="panel-page-intro">
          <h1 className="panel-page-title">Yönetim Paneli</h1>
          <p className="panel-page-subtitle">Hesap ve panel ayarlarınızı buradan yönetebilirsiniz.</p>
        </header>
        <aside className="panel-sidebar" aria-label="Panel menüsü">
          <div className="panel-sidebar-content">
            <div className="panel-sidebar-institution">
              <div className="panel-sidebar-institution-avatar-wrap">
                <div className="panel-sidebar-institution-avatar">
                  <Building2 className="panel-sidebar-institution-avatar-icon" aria-hidden />
                </div>
                <button
                  type="button"
                  className="panel-sidebar-institution-avatar-edit"
                  aria-label="Kurum profilini düzenle"
                  onClick={() => setActiveTab("institution-profile")}
                >
                  <PencilLine className="panel-sidebar-institution-avatar-edit-icon" aria-hidden />
                </button>
              </div>
              <h2 className="panel-sidebar-institution-name">{institutionName || "Yükleniyor…"}</h2>
              <p className="panel-sidebar-institution-role">Kurumsal Üye</p>
              <span className="panel-sidebar-institution-badge">Onaylı Hesap</span>
            </div>
            <nav className="panel-sidebar-nav">
              {PANEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`panel-sidebar-nav-item ${activeTab === tab.id ? "panel-sidebar-nav-item--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                >
                  {sidebarIcons[tab.id]}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>
        <div className="panel-page-main">
          <section
            className={
              isOverviewTab
                ? "panel-main-card panel-overview-card"
                : isInstitutionProfileTab
                  ? "panel-main-card panel-institution-card"
                  : "panel-main-card"
            }
            aria-labelledby={isOverviewTab ? "panel-overview-title" : "panel-card-title"}
          >
            {isOverviewTab ? (
              <>
                <div className="panel-overview-header">
                  <h2 id="panel-overview-title" className="panel-overview-title">
                    Genel Bakış
                  </h2>
                  <p className="panel-overview-subtitle">
                    Profil durumunuzu ve duyuruları buradan takip edebilirsiniz.
                  </p>
                </div>
                <div className="panel-overview-content">
                  <div className="panel-overview-cards">
                    <div className="panel-overview-summary-card panel-overview-summary-card--progress">
                      <div className="panel-overview-summary-card-text">
                        <span className="panel-overview-card-label">HESAP DURUMU</span>
                        <h3 className="panel-overview-card-title">Profil Tamamlanma Yüzdesi</h3>
                        <p className="panel-overview-card-desc">
                          Profilinizi %100 yaparak daha fazla özelliğe erişim sağlayın.
                        </p>
                      </div>
                      <div className="panel-overview-progress-wrap">
                        <div className="panel-overview-progress-ring" aria-hidden>
                          <span className="panel-overview-progress-value">85%</span>
                        </div>
                      </div>
                    </div>
                    <div className="panel-overview-summary-card">
                      <span className="panel-overview-card-label">KURUMSAL ONAY</span>
                      <h3 className="panel-overview-card-title">Onay Durumu</h3>
                      <div className="panel-overview-status-row">
                        <span className="panel-overview-status-chip">
                          <span className="panel-overview-status-dot" aria-hidden />
                          YAYINDA
                        </span>
                        <div className="panel-overview-status-icon" aria-hidden>
                          <CheckCircle className="panel-overview-status-check" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="panel-overview-announcements">
                    <div className="panel-overview-announcements-header">
                      <h3 className="panel-overview-announcements-title">Yaklaşan Duyurular</h3>
                      <span className="panel-overview-announcements-pill">SON DUYURULAR</span>
                    </div>
                    <ul className="panel-overview-announcements-list">
                      {OVERVIEW_ANNOUNCEMENTS.map((item) => (
                        <li key={item.id} className="panel-overview-announcements-item">
                          <div className={`panel-overview-announcements-icon panel-overview-announcements-icon--${item.iconBg}`}>
                            <item.icon className="panel-overview-announcements-icon-svg" aria-hidden />
                          </div>
                          <div className="panel-overview-announcements-body">
                            <span className="panel-overview-announcements-item-title">{item.title}</span>
                            <p className="panel-overview-announcements-item-desc">{item.description}</p>
                          </div>
                          <span className="panel-overview-announcements-time">{item.timeLabel}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="panel-overview-announcements-footer">
                      <button type="button" className="panel-overview-announcements-link">
                        Tüm Duyuruları Gör &gt;
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="panel-main-card-header">
              <div className="panel-main-card-header-left">
                {isAnnouncementsTab ? (
                  <Megaphone className="panel-main-card-icon" aria-hidden />
                ) : isRequestsTab ? (
                  <Inbox className="panel-main-card-icon" aria-hidden />
                ) : (
                  <Building2 className="panel-main-card-icon" aria-hidden />
                )}
                <h2 id="panel-card-title" className="panel-main-card-title">
                  {isAnnouncementsTab ? "İçerikler & Duyurular" : isRequestsTab ? "Talepler" : activeTabConfig.label}
                </h2>
              </div>
              {isInstitutionProfileTab ? (
                isEditingInstitutionProfile ? (
                  <Button
                    type="button"
                    variant="default"
                    className="panel-institution-save-btn"
                    onClick={handleInstitutionProfileSave}
                  >
                    Kaydet
                  </Button>
                ) : (
                  <button
                    type="button"
                    className="panel-main-card-edit-btn"
                    aria-label="Düzenle"
                    onClick={() => setIsEditingInstitutionProfile(true)}
                  >
                    <PencilLine className="panel-main-card-edit-icon" aria-hidden />
                  </button>
                )
              ) : isAnnouncementsTab ? (
                <Button
                  type="button"
                  variant="default"
                  className="panel-announcements-add-btn"
                  onClick={openNewAnnouncementModal}
                >
                  <Plus className="panel-announcements-add-btn-icon" aria-hidden />
                  Yeni Duyuru
                </Button>
              ) : isRequestsTab ? (
                <div className="panel-requests-filter-wrap">
                  <label htmlFor="panel-requests-status-filter" className="panel-requests-filter-label">
                    Durum
                  </label>
                  <select
                    id="panel-requests-status-filter"
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value as RequestStatusFilter)}
                    className="panel-requests-filter-select"
                    aria-label="Talep durumu filtrele"
                  >
                    <option value="all">Tümü</option>
                    <option value="pending">Beklemede</option>
                    <option value="approved">Onaylandı</option>
                    <option value="rejected">Reddedildi</option>
                  </select>
                </div>
              ) : (
                <button
                  type="button"
                  className="panel-main-card-edit-btn"
                  aria-label="Düzenle"
                  onClick={() => {}}
                >
                  <PencilLine className="panel-main-card-edit-icon" aria-hidden />
                </button>
              )}
            </div>
            {isInstitutionProfileTab ? (
              <div className="panel-institution-card-content">
                <div className="panel-institution-form">
                  <div className="panel-institution-form-row-first">
                    <div className="panel-institution-form-logo-wrap">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        className="panel-institution-form-logo-input"
                        aria-label="Kurum logosu yükle"
                        onChange={handleLogoFileChange}
                      />
                      <div
                        className={`panel-institution-form-logo-box ${logoUploading ? "panel-institution-form-logo-box--uploading" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (logoUploading) return;
                          logoFileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                          if (logoUploading) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            logoFileInputRef.current?.click();
                          }
                        }}
                        aria-label="Kurum logosu yükle"
                      >
                        {logoUploading ? (
                          <>
                            <Loader2 className="panel-institution-form-logo-icon panel-institution-form-logo-spinner" aria-hidden />
                            <span className="panel-institution-form-logo-loading-text">Yükleniyor…</span>
                          </>
                        ) : institutionFormData.logoUrl ? (
                          <img src={institutionFormData.logoUrl} alt="" className="panel-institution-form-logo-img" />
                        ) : (
                          <Upload className="panel-institution-form-logo-icon" aria-hidden />
                        )}
                      </div>
                      <span className="panel-institution-form-label">Kurum Logosu</span>
                      {logoUploadError && (
                        <span className="panel-institution-form-logo-error" role="alert">
                          {logoUploadError}
                        </span>
                      )}
                    </div>
                    <div className="panel-institution-form-first-fields">
                      <div className="panel-institution-form-field">
                        <label className="panel-institution-form-label">Kurum Adı</label>
                        <Input
                          type="text"
                          value={institutionFormData.institutionName}
                          onChange={(e) => handleInstitutionFormChange("institutionName", e.target.value)}
                          disabled={!isEditingInstitutionProfile}
                          className="panel-institution-form-input"
                        />
                      </div>
                      <div className="panel-institution-form-field">
                        <label className="panel-institution-form-label">Resmi E-posta</label>
                        <Input
                          type="email"
                          value={institutionFormData.email}
                          onChange={(e) => handleInstitutionFormChange("email", e.target.value)}
                          disabled={!isEditingInstitutionProfile}
                          className="panel-institution-form-input"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="panel-institution-form-row">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">TELEFON</label>
                      <Input
                        type="tel"
                        value={institutionFormData.phone}
                        onChange={(e) => handleInstitutionFormChange("phone", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">WEB SİTESİ</label>
                      <Input
                        type="url"
                        value={institutionFormData.website}
                        onChange={(e) => handleInstitutionFormChange("website", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                        placeholder="https://"
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">ŞEHİR</label>
                      <Input
                        type="text"
                        value={institutionFormData.city}
                        onChange={(e) => handleInstitutionFormChange("city", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">İLÇE</label>
                      <Input
                        type="text"
                        value={institutionFormData.district}
                        onChange={(e) => handleInstitutionFormChange("district", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-input"
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row panel-institution-form-row--full">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">ADRES</label>
                      <textarea
                        value={institutionFormData.address}
                        onChange={(e) => handleInstitutionFormChange("address", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-textarea"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="panel-institution-form-row panel-institution-form-row--full">
                    <div className="panel-institution-form-field">
                      <label className="panel-institution-form-label">HAKKINDA</label>
                      <textarea
                        value={institutionFormData.about}
                        onChange={(e) => handleInstitutionFormChange("about", e.target.value)}
                        disabled={!isEditingInstitutionProfile}
                        className="panel-institution-form-textarea"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : isAnnouncementsTab ? (
              <div className="panel-announcements-content">
                <div className="panel-announcements-table-wrap">
                  <table className="panel-announcements-table">
                    <thead>
                      <tr>
                        <th className="panel-announcements-th">Başlık</th>
                        <th className="panel-announcements-th">Kısa açıklama</th>
                        <th className="panel-announcements-th">Tarih</th>
                        <th className="panel-announcements-th">Durum</th>
                        <th className="panel-announcements-th panel-announcements-th-actions">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {announcementsList.map((row) => (
                        <tr key={row.id} className="panel-announcements-tr">
                          <td className="panel-announcements-td panel-announcements-td-title">
                            {row.title}
                          </td>
                          <td className="panel-announcements-td panel-announcements-td-desc">
                            <span className="panel-announcements-desc-clamp">{row.content}</span>
                          </td>
                          <td className="panel-announcements-td">{row.date}</td>
                          <td className="panel-announcements-td">
                            <span
                              className={
                                row.status === "published"
                                  ? "panel-announcements-badge panel-announcements-badge--published"
                                  : "panel-announcements-badge panel-announcements-badge--draft"
                              }
                            >
                              {row.status === "published" ? "Yayında" : "Taslak"}
                            </span>
                          </td>
                          <td className="panel-announcements-td panel-announcements-td-actions">
                            <button
                              type="button"
                              className="panel-announcements-action-btn"
                              aria-label="Düzenle"
                              onClick={() => openEditAnnouncementModal(row)}
                            >
                              <PencilLine className="panel-announcements-action-icon" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="panel-announcements-action-btn"
                              aria-label="Sil"
                              onClick={() => handleAnnouncementDelete(row.id)}
                            >
                              <Trash2 className="panel-announcements-action-icon" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : isRequestsTab ? (
              <div className="panel-requests-content">
                {filteredRequests.length === 0 ? (
                  <div className="panel-requests-empty">
                    <p className="panel-requests-empty-text">
                      {requestStatusFilter === "all" ? "Henüz talep bulunmuyor." : "Bu filtrede sonuç yok."}
                    </p>
                  </div>
                ) : (
                  <div className="panel-requests-list">
                    {filteredRequests.map((row) => (
                      <div key={row.id} className="panel-requests-item">
                        <div className="panel-requests-item-row">
                          <div className="panel-requests-item-main">
                            <span className="panel-requests-item-type">{row.type}</span>
                            <span className="panel-requests-item-institution">{row.institutionName}</span>
                            <span className="panel-requests-item-date">{row.createdAt}</span>
                          </div>
                          <div className="panel-requests-item-meta">
                            <span
                              className={
                                row.status === "approved"
                                  ? "panel-requests-badge panel-requests-badge--approved"
                                  : row.status === "rejected"
                                    ? "panel-requests-badge panel-requests-badge--rejected"
                                    : "panel-requests-badge panel-requests-badge--pending"
                              }
                            >
                              {row.status === "approved" ? "Onaylandı" : row.status === "rejected" ? "Reddedildi" : "Beklemede"}
                            </span>
                            <button
                              type="button"
                              className="panel-requests-detail-btn"
                              onClick={() => toggleRequestDetail(row.id)}
                              aria-expanded={expandedRequestId === row.id}
                            >
                              {expandedRequestId === row.id ? "Gizle" : "Detay"}
                            </button>
                          </div>
                        </div>
                        {expandedRequestId === row.id && (
                          <div className="panel-requests-detail">
                            <div className="panel-requests-detail-row">
                              <span className="panel-requests-detail-label">Talep açıklaması</span>
                              <p className="panel-requests-detail-value">{row.description}</p>
                            </div>
                            {(row.status === "approved" || row.status === "rejected") && row.adminNote && (
                              <div className="panel-requests-detail-row">
                                <span className="panel-requests-detail-label">Admin notu</span>
                                <p className="panel-requests-detail-value">{row.adminNote}</p>
                              </div>
                            )}
                            <div className="panel-requests-detail-row">
                              <span className="panel-requests-detail-label">Son güncelleme</span>
                              <p className="panel-requests-detail-value">{row.updatedAt}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="panel-main-card-placeholder">{activeTabConfig.placeholder}</p>
            )}
              </>
            )}
          </section>
        </div>
      </div>

      {announcementModalOpen && (
        <div
          className="panel-announcement-modal-overlay"
          onClick={closeAnnouncementModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-announcement-modal-title"
        >
          <div className="panel-announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 id="panel-announcement-modal-title" className="panel-announcement-modal-title">
              {editingAnnouncementId ? "Duyuruyu Düzenle" : "Yeni Duyuru"}
            </h2>
            <div className="panel-announcement-modal-body">
              <div className="panel-announcement-modal-form">
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label">BAŞLIK</label>
                  <Input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => handleAnnouncementFormChange("title", e.target.value)}
                    className="panel-institution-form-input"
                  />
                  {announcementFormErrors.title && (
                    <span className="panel-announcement-modal-error">{announcementFormErrors.title}</span>
                  )}
                </div>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label">İÇERİK</label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => handleAnnouncementFormChange("content", e.target.value)}
                    className="panel-institution-form-textarea"
                    rows={4}
                  />
                  {announcementFormErrors.content && (
                    <span className="panel-announcement-modal-error">{announcementFormErrors.content}</span>
                  )}
                </div>
                <div className="panel-institution-form-field">
                  <label className="panel-institution-form-label">DURUM</label>
                  <select
                    value={announcementForm.status}
                    onChange={(e) =>
                      handleAnnouncementFormChange("status", e.target.value as AnnouncementStatus)
                    }
                    className="panel-announcement-status-select"
                  >
                    <option value="draft">Taslak</option>
                    <option value="published">Yayında</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="panel-announcement-modal-footer">
              <Button
                type="button"
                variant="outline"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--cancel"
                onClick={closeAnnouncementModal}
              >
                İptal
              </Button>
              <Button
                type="button"
                variant="default"
                className="panel-announcement-modal-btn panel-announcement-modal-btn--submit"
                onClick={handleAnnouncementSave}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
