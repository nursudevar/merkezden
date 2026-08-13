"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  resolveIndividualNameFromUsersClient,
  resolveIsAdminFromUserRolesClient,
  resolveInstitutionNameFromUsersClient,
  resolveInstitutionSlugFromUsersClient,
  resolveUserTypeFromUsersClient,
  type AppUserType,
} from "@/lib/auth/authBrowserClient";
import { resolveInstructorNameFromInstructorsClient } from "@/lib/instructorProfileClient";
import { Button } from "@/components/ui";
import SearchBar from "@/components/SearchBar";
import {
  LogIn,
  LogOut,
  LayoutDashboard,
  Menu,
  Shield,
  User,
  UserPlus,
  ListOrdered,
} from "lucide-react";

const NASIL_CALISIR_HREF = "/nasil-calisir";

/** Ana sayfa header ile birebir aynı logo (src, boyut, sınıflar). */
export const HEADER_BRAND_LOGO_WIDTH = 440;
export const HEADER_BRAND_LOGO_HEIGHT = 88;

export function HeaderBrandLogo() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <Link
      href="/"
      className="header-title-link"
      onClick={(e) => {
        if (!isHome) return;
        e.preventDefault();
        window.location.reload();
      }}
    >
      <Image
        src="/images/merkezden-logo.svg"
        alt="Merkezden"
        width={HEADER_BRAND_LOGO_WIDTH}
        height={HEADER_BRAND_LOGO_HEIGHT}
        className="header-logo"
        priority
      />
    </Link>
  );
}

interface HeaderWithSearchClientProps {
  user: { id: string; email?: string } | null;
  userType: AppUserType | null;
  isAdmin?: boolean;
  institutionName?: string | null;
  institutionSlug?: string | null;
  individualName?: string | null;
  instructorName?: string | null;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchTypewriterPlaceholders?: readonly string[];
  searchButtonText?: string;
  showSearchButton?: boolean;
}

export function HeaderWithSearchClient({
  user,
  userType,
  isAdmin = false,
  institutionName,
  institutionSlug,
  individualName,
  instructorName,
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchTypewriterPlaceholders,
  searchButtonText,
  showSearchButton = true,
}: HeaderWithSearchClientProps) {
  const welcomeName =
    userType === "institution"
      ? institutionName || "Kurum Hesabı"
      : userType === "instructor"
        ? instructorName || "Eğitmen Hesabı"
        : individualName || "Kullanıcı";
  const getCTALabel = () => {
    if (userType === "institution") return "YÖNETİM PANELİ";
    if (userType === "instructor") return "EĞİTMEN PANELİ";
    return "PROFİL";
  };

  const getCTAHref = () => {
    if (userType === "institution") return "/panel";
    if (userType === "instructor") return "/egitmen-paneli";
    return "/profile";
  };

  const shouldShowCTA = !!user;
  const institutionDetailHref = institutionSlug ? `/kurumlar/${institutionSlug}` : "/panel";

  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuRefDesktop = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isInsideAnyMenu = (target: EventTarget | null) =>
    menuRef.current?.contains(target as Node) || menuRefDesktop.current?.contains(target as Node);

  const handleLogout = async (closeMenu: "mobile" | "desktop") => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    if (closeMenu === "mobile") {
      setMenuOpen(false);
    } else {
      setDesktopMenuOpen(false);
    }
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isInsideAnyMenu(e.target)) return;
      setMenuOpen(false);
      setDesktopMenuOpen(false);
    }
    if (menuOpen || desktopMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen, desktopMenuOpen]);
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setDesktopMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!user) {
      setDesktopMenuOpen(false);
    }
  }, [user]);

  return (
    <>
      <div className="top-bar" />
      <header className={`header${user ? "" : " header--guest"}`}>
        <div className="header-container">
          <div className={`header-top-row navbar ${menuOpen ? "is-open" : ""}`}>
            <div className="header-brand">
              <HeaderBrandLogo />
            </div>
            <div className="header-hamburger header-hamburger-mobile" ref={menuRef}>
              <button
                type="button"
                className="header-hamburger-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-expanded={menuOpen}
                aria-label="Menü"
              >
                {user ? (
                  <User className="header-hamburger-btn-icon" aria-hidden />
                ) : (
                  <Menu className="header-hamburger-btn-icon" aria-hidden />
                )}
              </button>
              {menuOpen && (
                <div className="header-hamburger-dropdown">
                  {user &&
                    (userType === "institution" || userType === "individual" || userType === "instructor") &&
                    (userType === "institution" ? (
                      <Link
                        href={institutionDetailHref}
                        className="header-hamburger-welcome header-hamburger-welcome-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        <div className="header-hamburger-welcome-avatar" aria-hidden>
                          <User className="header-hamburger-welcome-avatar-icon" />
                        </div>
                        <div className="header-hamburger-welcome-text">
                          <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                          <span className="header-hamburger-welcome-name">{welcomeName}</span>
                        </div>
                      </Link>
                    ) : (
                      <div className="header-hamburger-welcome">
                        <div className="header-hamburger-welcome-avatar" aria-hidden>
                          <User className="header-hamburger-welcome-avatar-icon" />
                        </div>
                        <div className="header-hamburger-welcome-text">
                          <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                          <span className="header-hamburger-welcome-name">{welcomeName}</span>
                        </div>
                      </div>
                    ))}
                  {user && userType === "individual" && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === "institution" && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === "instructor" && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>Eğitmen Paneli</span>
                    </Link>
                  )}
                  {user && isAdmin && (
                    <Link href="/admin" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <Shield className="header-hamburger-icon" aria-hidden />
                      <span>Admin Panel</span>
                    </Link>
                  )}
                  {!user ? (
                    <Link
                      href={NASIL_CALISIR_HREF}
                      className="header-hamburger-link"
                      onClick={() => setMenuOpen(false)}
                    >
                      <ListOrdered className="header-hamburger-icon" aria-hidden />
                      <span>Nasıl Çalışır?</span>
                    </Link>
                  ) : null}
                  {user ? (
                    <>
                      {shouldShowCTA &&
                        userType !== "institution" &&
                        userType !== "individual" &&
                        userType !== "instructor" && (
                        <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                          <User className="header-hamburger-icon" aria-hidden />
                          <span>{getCTALabel()}</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        className="header-hamburger-link header-hamburger-link-button header-hamburger-link--logout"
                        onClick={() => handleLogout("mobile")}
                      >
                        <LogOut className="header-hamburger-icon" aria-hidden />
                        <span>Çıkış Yap</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                        <LogIn className="header-hamburger-icon" aria-hidden />
                        <span>Giriş Yap</span>
                      </Link>
                      <Link
                        href="/signup"
                        className="header-hamburger-link header-hamburger-link--auth-register"
                        onClick={() => setMenuOpen(false)}
                      >
                        <UserPlus className="header-hamburger-icon" aria-hidden />
                        <span>Kayıt Ol</span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {onSearchChange && (
            <div className="header-search">
              <SearchBar
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder || "Örnek: Kadıköy'de çocuğum için yüzme kursu arıyorum"}
                typewriterPlaceholders={searchTypewriterPlaceholders}
                buttonText={searchButtonText || "ARA"}
                showButton={showSearchButton}
              />
            </div>
          )}
          <div className="header-actions">
            {user ? (
              <>
                <Link href={getCTAHref()} className="header-actions-nav header-actions-profile">
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    {getCTALabel()}
                  </Button>
                </Link>
                {isAdmin ? (
                  <Link href="/admin" className="header-actions-nav header-actions-profile">
                    <Button className="button-primary btn-gradient-primary" variant="default">
                      ADMIN PANEL
                    </Button>
                  </Link>
                ) : null}
              </>
            ) : (
              <div className="header-actions-auth">
                <Link href="/login">
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    GİRİŞ YAP
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="button-primary btn-gradient-signup" variant="default">
                    KAYIT OL
                  </Button>
                </Link>
                <Link href={NASIL_CALISIR_HREF} className="header-actions-how">
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    NASIL ÇALIŞIR?
                  </Button>
                </Link>
              </div>
            )}
            {user ? (
            <div className={`header-actions-desktop-menu ${desktopMenuOpen ? "is-open" : ""}`} ref={menuRefDesktop}>
                <Button
                  type="button"
                  className="header-actions-account-btn button-primary btn-gradient-primary"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDesktopMenuOpen((prev) => !prev);
                  }}
                  aria-expanded={desktopMenuOpen}
                  aria-label="Hesabım"
                >
                  Hesabım
                </Button>
              {desktopMenuOpen && (
                <div className="header-hamburger-dropdown header-hamburger-dropdown-desktop">
                  {user &&
                    (userType === "institution" || userType === "individual" || userType === "instructor") &&
                    (userType === "institution" ? (
                      <Link
                        href={institutionDetailHref}
                        className="header-hamburger-welcome header-hamburger-welcome-link"
                        onClick={() => setDesktopMenuOpen(false)}
                      >
                        <div className="header-hamburger-welcome-avatar" aria-hidden>
                          <User className="header-hamburger-welcome-avatar-icon" />
                        </div>
                        <div className="header-hamburger-welcome-text">
                          <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                          <span className="header-hamburger-welcome-name">{welcomeName}</span>
                        </div>
                      </Link>
                    ) : (
                      <div className="header-hamburger-welcome">
                        <div className="header-hamburger-welcome-avatar" aria-hidden>
                          <User className="header-hamburger-welcome-avatar-icon" />
                        </div>
                        <div className="header-hamburger-welcome-text">
                          <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                          <span className="header-hamburger-welcome-name">{welcomeName}</span>
                        </div>
                      </div>
                    ))}
                  {user && userType === "individual" && shouldShowCTA && (
                    <Link
                      href={getCTAHref()}
                      className="header-hamburger-link"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === "institution" && shouldShowCTA && (
                    <Link
                      href={getCTAHref()}
                      className="header-hamburger-link"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === "instructor" && shouldShowCTA && (
                    <Link
                      href={getCTAHref()}
                      className="header-hamburger-link"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>EĞİTMEN PANELİ</span>
                    </Link>
                  )}
                  {user && isAdmin && (
                    <Link
                      href="/admin"
                      className="header-hamburger-link"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <Shield className="header-hamburger-icon" aria-hidden />
                      <span>ADMIN PANEL</span>
                    </Link>
                  )}
                  {shouldShowCTA &&
                    userType !== "institution" &&
                    userType !== "individual" &&
                    userType !== "instructor" && (
                    <Link
                      href={getCTAHref()}
                      className="header-hamburger-link"
                      onClick={() => setDesktopMenuOpen(false)}
                    >
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && (
                    <button
                      type="button"
                      className="header-hamburger-link header-hamburger-link-button header-hamburger-link--logout"
                      onClick={() => handleLogout("desktop")}
                    >
                      <LogOut className="header-hamburger-icon" aria-hidden />
                      <span>ÇIKIŞ YAP</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            ) : null}
          </div>
        </div>
      </header>
    </>
  );
}

interface HeaderClientProps {
  initialUser: { id: string; email?: string } | null;
  initialUserType: AppUserType | null;
  initialIsAdmin?: boolean;
  initialInstitutionName?: string | null;
  initialInstitutionSlug?: string | null;
  initialIndividualName?: string | null;
  initialInstructorName?: string | null;
}

export function HeaderClient({
  initialUser,
  initialUserType,
  initialIsAdmin = false,
  initialInstitutionName,
  initialInstitutionSlug,
  initialIndividualName,
  initialInstructorName,
}: HeaderClientProps) {
  return (
    <HeaderWithSearchClient
      user={initialUser}
      userType={initialUserType}
      isAdmin={initialIsAdmin}
      institutionName={initialInstitutionName}
      institutionSlug={initialInstitutionSlug}
      individualName={initialIndividualName}
      instructorName={initialInstructorName}
    />
  );
}

interface HeaderWithSearchProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchTypewriterPlaceholders?: readonly string[];
  searchButtonText?: string;
  showSearchButton?: boolean;
}

export function HeaderWithSearch({
  searchValue = "",
  onSearchChange,
  searchPlaceholder,
  searchTypewriterPlaceholders,
  searchButtonText,
  showSearchButton,
}: HeaderWithSearchProps) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userType, setUserType] = useState<AppUserType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [institutionSlug, setInstitutionSlug] = useState<string | null>(null);
  const [individualName, setIndividualName] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const authUser = session?.user ?? null;
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
        if (!authUser) {
          setUserType(null);
          setIsAdmin(false);
          setInstitutionName(null);
          setInstitutionSlug(null);
          setIndividualName(null);
          setInstructorName(null);
        }
        setIsAuthReady(true);
      });
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        const authUser = session?.user ?? null;
        setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
        if (!authUser) {
          setUserType(null);
          setIsAdmin(false);
          setInstitutionName(null);
          setInstitutionSlug(null);
          setIndividualName(null);
          setInstructorName(null);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    resolveIsAdminFromUserRolesClient(user.id).then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUserType(null);
      setInstitutionName(null);
      return;
    }
    let cancelled = false;
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) setUserType(type);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || userType !== "institution") {
      setInstitutionName(null);
      return;
    }
    let cancelled = false;
    resolveInstitutionNameFromUsersClient(user.id, user.email).then((name) => {
      if (!cancelled) setInstitutionName(name || "Kurum Hesabı");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "institution") {
      setInstitutionSlug(null);
      return;
    }
    let cancelled = false;
    resolveInstitutionSlugFromUsersClient(user.id, user.email).then((slug) => {
      if (!cancelled) setInstitutionSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "individual") {
      setIndividualName(null);
      return;
    }
    let cancelled = false;
    resolveIndividualNameFromUsersClient(user.id).then((name) => {
      if (!cancelled) setIndividualName(name || "Kullanıcı");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "instructor") {
      setInstructorName(null);
      return;
    }
    let cancelled = false;
    resolveInstructorNameFromInstructorsClient(user.id).then((name) => {
      if (!cancelled) setInstructorName(name || "Eğitmen");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, userType]);

  const displayUser = isAuthReady ? user : null;
  const displayUserType = isAuthReady ? userType : null;

  return (
    <HeaderWithSearchClient
      user={displayUser}
      userType={displayUserType}
      isAdmin={isAdmin}
      institutionName={displayUserType === "institution" ? institutionName : null}
      institutionSlug={displayUserType === "institution" ? institutionSlug : null}
      individualName={displayUserType === "individual" ? individualName : null}
      instructorName={displayUserType === "instructor" ? instructorName : null}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchTypewriterPlaceholders={searchTypewriterPlaceholders}
      searchButtonText={searchButtonText}
      showSearchButton={showSearchButton}
    />
  );
}

export function HeaderClientWrapper() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userType, setUserType] = useState<AppUserType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [institutionSlug, setInstitutionSlug] = useState<string | null>(null);
  const [individualName, setIndividualName] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const authUser = session?.user ?? null;
      queueMicrotask(() => {
        if (cancelled) return;
        setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
        if (!authUser) {
          setUserType(null);
          setIsAdmin(false);
          setInstitutionName(null);
          setInstitutionSlug(null);
          setIndividualName(null);
          setInstructorName(null);
        }
        setIsAuthReady(true);
      });
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (cancelled) return;
        const authUser = session?.user ?? null;
        setUser(authUser ? { id: authUser.id, email: authUser.email } : null);
        if (!authUser) {
          setUserType(null);
          setIsAdmin(false);
          setInstitutionName(null);
          setInstitutionSlug(null);
          setIndividualName(null);
          setInstructorName(null);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    resolveIsAdminFromUserRolesClient(user.id).then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUserType(null);
      setInstitutionName(null);
      return;
    }
    let cancelled = false;
    resolveUserTypeFromUsersClient(user.id).then((type) => {
      if (!cancelled) setUserType(type);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || userType !== "institution") {
      setInstitutionName(null);
      return;
    }
    let cancelled = false;
    resolveInstitutionNameFromUsersClient(user.id, user.email).then((name) => {
      if (!cancelled) setInstitutionName(name || "Kurum Hesabı");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "institution") {
      setInstitutionSlug(null);
      return;
    }
    let cancelled = false;
    resolveInstitutionSlugFromUsersClient(user.id, user.email).then((slug) => {
      if (!cancelled) setInstitutionSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "individual") {
      setIndividualName(null);
      return;
    }
    let cancelled = false;
    resolveIndividualNameFromUsersClient(user.id).then((name) => {
      if (!cancelled) setIndividualName(name || "Kullanıcı");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, userType]);

  useEffect(() => {
    if (!user?.id || userType !== "instructor") {
      setInstructorName(null);
      return;
    }
    let cancelled = false;
    resolveInstructorNameFromInstructorsClient(user.id).then((name) => {
      if (!cancelled) setInstructorName(name || "Eğitmen");
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, userType]);

  const displayUser = isAuthReady ? user : null;
  const displayUserType = isAuthReady ? userType : null;

  return (
    <HeaderClient
      initialUser={displayUser}
      initialUserType={displayUserType}
      initialIsAdmin={isAdmin}
      initialInstitutionName={displayUserType === "institution" ? institutionName : null}
      initialInstitutionSlug={displayUserType === "institution" ? institutionSlug : null}
      initialIndividualName={displayUserType === "individual" ? individualName : null}
      initialInstructorName={displayUserType === "instructor" ? instructorName : null}
    />
  );
}
