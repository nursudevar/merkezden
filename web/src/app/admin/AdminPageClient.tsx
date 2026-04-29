"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  FileText,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  User,
  Users,
  BookOpenText,
  PencilLine,
  Trash2,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import { HeaderClientWrapper } from "@/components/layout/header.client";
import { Card, CardContent } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { allBlogPosts } from "@/lib/data/blog";
import "@/styles/main.scss";
import "@/styles/pages/admin.scss";

type AdminTabId =
  | "overview"
  | "institutions"
  | "users"
  | "announcements"
  | "blog-posts"
  | "settings";

type AdminMetricCard = {
  id: "users" | "institutions" | "announcements" | "blog-posts";
  title: string;
  icon: React.ReactNode;
  value: number | null;
  note?: string | null;
  loading: boolean;
  error: string | null;
};

type InstitutionListRow = {
  id: number;
  institution_name: string | null;
  type: string | null;
  district: string | null;
  institution_type?: {
    name?: string | null;
    category?: { name?: string | null } | null;
  } | null;
};

const INSTITUTIONS_PAGE_SIZE = 10;

export default function AdminPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [institutionsCount, setInstitutionsCount] = useState<number | null>(null);
  const [announcementsCount, setAnnouncementsCount] = useState<number | null>(null);
  const [blogPostsCount, setBlogPostsCount] = useState<number | null>(null);

  const [usersLoading, setUsersLoading] = useState(true);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [blogLoading, setBlogLoading] = useState(true);

  const [usersError, setUsersError] = useState<string | null>(null);
  const [institutionsError, setInstitutionsError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [blogNote, setBlogNote] = useState<string | null>(null);
  const [institutionsList, setInstitutionsList] = useState<InstitutionListRow[]>([]);
  const [institutionsListLoading, setInstitutionsListLoading] = useState(false);
  const [institutionsListError, setInstitutionsListError] = useState<string | null>(null);
  const [institutionsPage, setInstitutionsPage] = useState(1);
  const [institutionsPageInput, setInstitutionsPageInput] = useState("1");
  const [institutionsSearchInput, setInstitutionsSearchInput] = useState("");
  const [institutionsSearchQuery, setInstitutionsSearchQuery] = useState("");
  const [institutionsTotalCount, setInstitutionsTotalCount] = useState(0);
  const [mediaCountByInstitutionId, setMediaCountByInstitutionId] = useState<Record<number, number>>({});
  const [deletingInstitutionId, setDeletingInstitutionId] = useState<number | null>(null);
  const [institutionsReloadKey, setInstitutionsReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadCount = async (
      table: string,
      onSuccess: (count: number) => void,
      onError: () => void,
      onDone: () => void
    ) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (cancelled) return;
      if (error) {
        onError();
      } else {
        onSuccess(count ?? 0);
      }
      onDone();
    };

    void loadCount(
      "users",
      (count) => {
        setUsersCount(count);
        setUsersError(null);
      },
      () => {
        setUsersCount(null);
        setUsersError("Kullanıcı sayısı alınamadı.");
      },
      () => setUsersLoading(false)
    );

    void loadCount(
      "institutions",
      (count) => {
        setInstitutionsCount(count);
        setInstitutionsError(null);
      },
      () => {
        setInstitutionsCount(null);
        setInstitutionsError("Kurum sayısı alınamadı.");
      },
      () => setInstitutionsLoading(false)
    );

    void loadCount(
      "announcements",
      (count) => {
        setAnnouncementsCount(count);
        setAnnouncementsError(null);
      },
      () => {
        setAnnouncementsCount(null);
        setAnnouncementsError("Duyuru sayısı alınamadı.");
      },
      () => setAnnouncementsLoading(false)
    );

    (async () => {
      const { count, error } = await supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true });

      if (cancelled) return;

      if (error) {
        const isMissingBlogTable =
          String(error.code ?? "") === "42P01" ||
          String(error.message ?? "").toLowerCase().includes("does not exist");

        if (isMissingBlogTable) {
          setBlogPostsCount(allBlogPosts.length);
          setBlogError(null);
          setBlogNote("Geçici: blog_posts tablosu yerine statik blog verisi kullanıldı.");
        } else {
          setBlogPostsCount(null);
          setBlogError("Blog yazısı sayısı alınamadı.");
          setBlogNote(null);
        }
      } else {
        setBlogPostsCount(count ?? 0);
        setBlogError(null);
        setBlogNote(null);
      }
      setBlogLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics: AdminMetricCard[] = [
    {
      id: "users",
      title: "Kullanıcılar",
      icon: <Users className="admin-overview-metric-icon" aria-hidden />,
      value: usersCount,
      loading: usersLoading,
      error: usersError,
    },
    {
      id: "institutions",
      title: "Kurumlar",
      icon: <Building2 className="admin-overview-metric-icon" aria-hidden />,
      value: institutionsCount,
      loading: institutionsLoading,
      error: institutionsError,
    },
    {
      id: "announcements",
      title: "Duyurular",
      icon: <Megaphone className="admin-overview-metric-icon" aria-hidden />,
      value: announcementsCount,
      loading: announcementsLoading,
      error: announcementsError,
    },
    {
      id: "blog-posts",
      title: "Blog Yazıları",
      icon: <FileText className="admin-overview-metric-icon" aria-hidden />,
      value: blogPostsCount,
      note: blogNote,
      loading: blogLoading,
      error: blogError,
    },
  ];

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  useEffect(() => {
    if (activeTab !== "institutions") return;
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const loadInstitutionsPage = async () => {
      setInstitutionsListLoading(true);
      setInstitutionsListError(null);

      const from = (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE;
      const to = from + INSTITUTIONS_PAGE_SIZE - 1;

      let institutionsQuery = supabase
        .from("institutions")
        .select(
          "id, institution_name, type, district, institution_type:institution_types(name, category:institution_categories(name))",
          { count: "exact" }
        )
        .order("id", { ascending: false });

      const normalizedSearch = institutionsSearchQuery.trim();
      if (normalizedSearch.length > 0) {
        institutionsQuery = institutionsQuery.ilike("institution_name", `%${normalizedSearch}%`);
      }

      const { data, count, error } = await institutionsQuery.range(from, to);

      if (cancelled) return;

      if (error) {
        setInstitutionsList([]);
        setInstitutionsTotalCount(0);
        setMediaCountByInstitutionId({});
        setInstitutionsListError("Kurum listesi alınamadı.");
        setInstitutionsListLoading(false);
        return;
      }

      const rows = (data ?? []) as InstitutionListRow[];
      setInstitutionsList(rows);
      setInstitutionsTotalCount(count ?? 0);

      const ids = rows.map((row) => row.id).filter((id) => Number.isFinite(id));
      if (ids.length === 0) {
        setMediaCountByInstitutionId({});
        setInstitutionsListLoading(false);
        return;
      }

      const { data: mediaRows, error: mediaError } = await supabase
        .from("institution_media")
        .select("institution_id")
        .in("institution_id", ids);

      if (cancelled) return;

      if (mediaError) {
        setMediaCountByInstitutionId({});
      } else {
        const counts: Record<number, number> = {};
        (mediaRows ?? []).forEach((row: { institution_id: number | null }) => {
          const institutionId = Number(row.institution_id);
          if (!Number.isFinite(institutionId)) return;
          counts[institutionId] = (counts[institutionId] ?? 0) + 1;
        });
        setMediaCountByInstitutionId(counts);
      }

      setInstitutionsListLoading(false);
    };

    void loadInstitutionsPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, institutionsPage, institutionsReloadKey, institutionsSearchQuery]);

  const institutionsPageCount = Math.max(1, Math.ceil(institutionsTotalCount / INSTITUTIONS_PAGE_SIZE));
  const institutionsVisibleRangeStart = institutionsTotalCount === 0 ? 0 : (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE + 1;
  const institutionsVisibleRangeEnd = Math.min(
    institutionsPage * INSTITUTIONS_PAGE_SIZE,
    institutionsTotalCount
  );

  useEffect(() => {
    setInstitutionsPageInput(String(institutionsPage));
  }, [institutionsPage]);

  const handleGoToInstitutionsPage = () => {
    const parsed = Number.parseInt(institutionsPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setInstitutionsPageInput(String(institutionsPage));
      return;
    }
    const targetPage = Math.min(Math.max(parsed, 1), institutionsPageCount);
    setInstitutionsPage(targetPage);
  };

  const handleInstitutionSearch = () => {
    setInstitutionsPage(1);
    setInstitutionsSearchQuery(institutionsSearchInput.trim());
  };

  const handleDeleteInstitution = async (institutionId: number) => {
    const approved = window.confirm("Bu kurumu silmek istediğinize emin misiniz?");
    if (!approved) return;

    const supabase = createSupabaseBrowserClient();
    setDeletingInstitutionId(institutionId);
    try {
      const { error } = await supabase.from("institutions").delete().eq("id", institutionId);
      if (error) {
        setInstitutionsListError("Kurum silinirken bir hata oluştu.");
        return;
      }

      const nextTotal = Math.max(0, institutionsTotalCount - 1);
      setInstitutionsTotalCount(nextTotal);
      setInstitutionsCount((prev) => (typeof prev === "number" ? Math.max(0, prev - 1) : prev));
      if (institutionsPage > 1 && (institutionsPage - 1) * INSTITUTIONS_PAGE_SIZE >= nextTotal) {
        setInstitutionsPage((prev) => Math.max(1, prev - 1));
      } else {
        setInstitutionsReloadKey((prev) => prev + 1);
      }
    } finally {
      setDeletingInstitutionId(null);
    }
  };

  const institutionsRows = useMemo(() => {
    return institutionsList.map((row) => {
      const category =
        String(row.institution_type?.category?.name ?? "").trim() ||
        String(row.institution_type?.name ?? "").trim() ||
        String(row.type ?? "").trim() ||
        "-";
      return {
        id: row.id,
        name: String(row.institution_name ?? "").trim() || "-",
        category,
        district: String(row.district ?? "").trim() || "-",
        mediaCount: mediaCountByInstitutionId[row.id] ?? 0,
      };
    });
  }, [institutionsList, mediaCountByInstitutionId]);

  const activeTabTitle =
    activeTab === "users"
      ? "Kullanıcılar"
      : activeTab === "announcements"
        ? "Duyurular"
        : activeTab === "blog-posts"
          ? "Blog Yazıları"
          : activeTab === "settings"
            ? "Ayarlar"
            : "";

  return (
    <div className="admin-page">
      <HeaderClientWrapper />
      <div className="admin-page-container">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-content">
            <div className="admin-sidebar-avatar">
              <div className="admin-sidebar-avatar-placeholder">
                <Shield className="admin-sidebar-avatar-icon" />
              </div>
            </div>
            <h2 className="admin-sidebar-name">Admin Panel</h2>

            <nav className="admin-sidebar-nav">
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "overview" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                <BarChart3 className="admin-sidebar-nav-icon" />
                <span>Genel Bakış</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "institutions" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("institutions")}
              >
                <Building2 className="admin-sidebar-nav-icon" />
                <span>Kurumlar</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "users" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("users")}
              >
                <Users className="admin-sidebar-nav-icon" />
                <span>Kullanıcılar</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "announcements" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("announcements")}
              >
                <Megaphone className="admin-sidebar-nav-icon" />
                <span>Duyurular</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "blog-posts" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("blog-posts")}
              >
                <BookOpenText className="admin-sidebar-nav-icon" />
                <span>Blog Yazıları</span>
              </button>
              <button
                type="button"
                className={`admin-sidebar-nav-item ${activeTab === "settings" ? "admin-sidebar-nav-item--active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <Settings className="admin-sidebar-nav-icon" />
                <span>Ayarlar</span>
              </button>
              <button
                type="button"
                className="admin-sidebar-nav-item admin-sidebar-nav-item--logout"
                onClick={handleLogout}
              >
                <LogOut className="admin-sidebar-nav-icon" />
                <span>Çıkış Yap</span>
              </button>
            </nav>
          </div>
        </aside>

        <div className="admin-page-main">
          <div className="admin-overview-metrics-grid">
            {metrics.map((metric) => (
              <Card key={metric.id} className="admin-overview-metric-card">
                <CardContent className="admin-overview-metric-card-content">
                  <div className="admin-overview-metric-top">
                    {metric.icon}
                    <span className="admin-overview-metric-title">{metric.title}</span>
                  </div>
                  <div className="admin-overview-metric-value-wrap">
                    {metric.loading ? (
                      <span className="admin-overview-metric-value">Yükleniyor...</span>
                    ) : metric.error ? (
                      <span className="admin-overview-metric-error">{metric.error}</span>
                    ) : (
                      <span className="admin-overview-metric-value">
                        {metric.value ?? "-"}
                      </span>
                    )}
                  </div>
                  {metric.note ? (
                    <p className="admin-overview-metric-note">{metric.note}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {activeTab === "overview" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content">
                <div className="admin-main-card-header">
                  <h1 className="admin-main-card-title">Genel Bakış</h1>
                  <p className="admin-main-card-subtitle">
                    Yönetim metrikleri bu alanda görüntülenir.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "institutions" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content admin-main-card-content--institutions">
                <div className="admin-main-card-header admin-main-card-header--institutions">
                  <div className="admin-institutions-header-left">
                    <h1 className="admin-main-card-title">Kayıtlı Kurumlar</h1>
                    <span className="admin-institutions-total-badge">
                      {`${institutionsTotalCount.toLocaleString("tr-TR")} TOPLAM`}
                    </span>
                  </div>
                  <div className="admin-institutions-header-actions">
                    <div className="admin-institutions-header-search">
                      <input
                        type="text"
                        className="admin-institutions-page-search-input"
                        value={institutionsSearchInput}
                        onChange={(event) => setInstitutionsSearchInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleInstitutionSearch();
                          }
                        }}
                        placeholder="Kurum ara"
                      />
                      <button
                        type="button"
                        className="admin-institutions-page-jump-btn"
                        onClick={handleInstitutionSearch}
                      >
                        Ara
                      </button>
                    </div>
                    <button
                      type="button"
                      className="admin-institutions-header-action-btn"
                      aria-label="Filtrele"
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                    <button
                      type="button"
                      className="admin-institutions-header-action-btn"
                      aria-label="Dışa aktar"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                {institutionsListLoading ? (
                  <div className="admin-institutions-empty">Yükleniyor...</div>
                ) : institutionsListError ? (
                  <div className="admin-institutions-empty">{institutionsListError}</div>
                ) : institutionsRows.length === 0 ? (
                  <div className="admin-institutions-empty">Kurum bulunamadı.</div>
                ) : (
                  <>
                    <table className="admin-institutions-table">
                      <thead>
                        <tr>
                          <th>Kurum Adı</th>
                          <th>Kategori</th>
                          <th>İlçe</th>
                          <th>Görsel Sayısı</th>
                          <th>Düzenle</th>
                          <th>Sil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {institutionsRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.name}</td>
                            <td className="admin-institutions-category-cell">
                              <span className="admin-institutions-category-badge">
                                {row.category}
                              </span>
                            </td>
                            <td>{row.district}</td>
                            <td>{row.mediaCount}</td>
                            <td>
                              <Link href={`/panel?institutionId=${row.id}`} className="admin-institutions-action-btn" aria-label="Kurum düzenle">
                                <PencilLine size={16} />
                              </Link>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-institutions-action-btn admin-institutions-action-btn--danger"
                                onClick={() => handleDeleteInstitution(row.id)}
                                disabled={deletingInstitutionId === row.id}
                                aria-label="Kurum sil"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="admin-institutions-pagination">
                      <p className="admin-institutions-pagination-info">
                        {`${institutionsVisibleRangeStart} - ${institutionsVisibleRangeEnd} / ${institutionsTotalCount} kurum gösteriliyor`}
                      </p>
                      <div className="admin-institutions-pagination-controls">
                        <button
                          type="button"
                          className="admin-institutions-page-btn"
                          disabled={institutionsPage <= 1}
                          onClick={() => setInstitutionsPage((prev) => Math.max(1, prev - 1))}
                        >
                          ‹
                        </button>
                        <span className="admin-institutions-page-indicator">
                          {institutionsPage} / {institutionsPageCount}
                        </span>
                        <button
                          type="button"
                          className="admin-institutions-page-btn"
                          disabled={institutionsPage >= institutionsPageCount}
                          onClick={() =>
                            setInstitutionsPage((prev) => Math.min(institutionsPageCount, prev + 1))
                          }
                        >
                          ›
                        </button>
                        <div className="admin-institutions-page-jump">
                          <span className="admin-institutions-page-jump-label">Sayfaya git</span>
                          <input
                            type="number"
                            min={1}
                            max={institutionsPageCount}
                            className="admin-institutions-page-jump-input"
                            value={institutionsPageInput}
                            onChange={(event) => setInstitutionsPageInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleGoToInstitutionsPage();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-institutions-page-jump-btn"
                            onClick={handleGoToInstitutionsPage}
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab !== "overview" && activeTab !== "institutions" ? (
            <Card className="admin-main-card">
              <CardContent className="admin-main-card-content">
                <div className="admin-main-card-header">
                  <h1 className="admin-main-card-title">{activeTabTitle}</h1>
                  <p className="admin-main-card-subtitle">
                    Bu sekme yakında yönetim aksiyonlarıyla genişletilecektir.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

