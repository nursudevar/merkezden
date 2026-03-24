"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import SearchBar from '@/components/SearchBar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { GraduationCap, Info, Phone, HelpCircle, LogIn, LogOut, LayoutDashboard, User } from 'lucide-react';

interface HeaderWithSearchClientProps {
  user: { id: string; email?: string } | null;
  userType: 'individual' | 'institution' | null;
  institutionName?: string | null;
  individualName?: string | null;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
  showSearchButton?: boolean;
}

export default function HeaderWithSearchClient({
  user,
  userType,
  institutionName,
  individualName,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
  showSearchButton = true,
}: HeaderWithSearchClientProps) {
  const welcomeName = userType === 'institution' ? (institutionName || 'Kurum Hesabı') : (individualName || 'Kullanıcı');
  const getCTALabel = () => {
    if (userType === 'institution') return 'YÖNETİM PANELİ';
    return 'PROFİL';
  };

  const getCTAHref = () => {
    if (userType === 'institution') return '/panel';
    return '/profile';
  };

  const shouldShowCTA = !!user;

  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuRefDesktop = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isInsideAnyMenu = (target: EventTarget | null) =>
    menuRef.current?.contains(target as Node) || menuRefDesktop.current?.contains(target as Node);

  const handleLogout = async (closeMenu: 'mobile' | 'desktop') => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    if (closeMenu === 'mobile') {
      setMenuOpen(false);
    } else {
      setDesktopMenuOpen(false);
    }
    router.push('/');
    router.refresh();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isInsideAnyMenu(e.target)) return;
      setMenuOpen(false);
      setDesktopMenuOpen(false);
    }
    if (menuOpen || desktopMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen, desktopMenuOpen]);
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setDesktopMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className={`header-top-row navbar ${menuOpen ? 'is-open' : ''}`}>
            <div className="header-brand">
              <Link href="/" className="header-title-link">
                <div className="header-logo-wrapper">
                  <Image
                    src="/images/merkezden-logo.png"
                    alt="Merkezden Logo"
                    width={60}
                    height={60}
                    className="header-logo"
                    priority
                  />
                  <div className="header-text-wrapper">
                    <span className="header-title">MERKEZDEN.COM</span>
                    <span className="header-subtitle">HAYATIN MERKEZİ</span>
                  </div>
                </div>
              </Link>
            </div>
            <div className="header-hamburger header-hamburger-mobile" ref={menuRef}>
              <button
                type="button"
                className="header-hamburger-btn nav-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-expanded={menuOpen}
                aria-label="Menü"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
              {menuOpen && (
                <div className="header-hamburger-dropdown">
                  {user && (userType === 'institution' || userType === 'individual') && (
                    <div className="header-hamburger-welcome">
                      <div className="header-hamburger-welcome-avatar" aria-hidden>
                        <User className="header-hamburger-welcome-avatar-icon" />
                      </div>
                      <div className="header-hamburger-welcome-text">
                        <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                        <span className="header-hamburger-welcome-name">
                          {welcomeName}
                        </span>
                      </div>
                    </div>
                  )}
                  {user && userType === 'individual' && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === 'institution' && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  <Link href="/okullar" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                    <GraduationCap className="header-hamburger-icon" aria-hidden />
                    <span>Tüm Okullar</span>
                  </Link>
                  <Link href="/about" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                    <Info className="header-hamburger-icon" aria-hidden />
                    <span>Hakkımızda</span>
                  </Link>
                  <Link href="/contact" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                    <Phone className="header-hamburger-icon" aria-hidden />
                    <span>İletişim</span>
                  </Link>
                  <Link href="/faq" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                    <HelpCircle className="header-hamburger-icon" aria-hidden />
                    <span>S.S.S</span>
                  </Link>
                  {user ? (
                    <>
                      {shouldShowCTA && userType !== 'institution' && userType !== 'individual' && (
                        <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                          <User className="header-hamburger-icon" aria-hidden />
                          <span>{getCTALabel()}</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        className="header-hamburger-link header-hamburger-link-button header-hamburger-link--logout"
                        onClick={() => handleLogout('mobile')}
                      >
                        <LogOut className="header-hamburger-icon" aria-hidden />
                        <span>Çıkış Yap</span>
                      </button>
                    </>
                  ) : (
                    <Link href="/login" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      <LogIn className="header-hamburger-icon" aria-hidden />
                      <span>Giriş Yap</span>
                    </Link>
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
                buttonText={searchButtonText || "ARA"}
                showButton={showSearchButton}
              />
            </div>
          )}
          <div className="header-actions">
            <Link href="/okullar" className="header-actions-nav header-actions-okullar">
              <Button className="button-primary btn-gradient-primary" variant="default">
                OKULLAR
              </Button>
            </Link>
            {user ? (
              <>
                <Link href={getCTAHref()} className="header-actions-nav header-actions-profile">
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    {getCTALabel()}
                  </Button>
                </Link>
              </>
            ) : (
              <div className="header-actions-auth">
                <Link href="/login">
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    GİRİŞ YAP
                  </Button>
                </Link>
              </div>
            )}
            <div className={`header-actions-desktop-menu ${desktopMenuOpen ? 'is-open' : ''}`} ref={menuRefDesktop}>
              <button
                type="button"
                className="header-hamburger-btn header-hamburger-btn-desktop nav-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setDesktopMenuOpen((prev) => !prev);
                }}
                aria-expanded={desktopMenuOpen}
                aria-label="Menü"
              >
                <span /><span /><span />
              </button>
              {desktopMenuOpen && (
                <div className="header-hamburger-dropdown header-hamburger-dropdown-desktop">
                  {user && (userType === 'institution' || userType === 'individual') && (
                    <div className="header-hamburger-welcome">
                      <div className="header-hamburger-welcome-avatar" aria-hidden>
                        <User className="header-hamburger-welcome-avatar-icon" />
                      </div>
                      <div className="header-hamburger-welcome-text">
                        <span className="header-hamburger-welcome-title">Hoşgeldiniz</span>
                        <span className="header-hamburger-welcome-name">
                          {welcomeName}
                        </span>
                      </div>
                    </div>
                  )}
                  {user && userType === 'individual' && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && userType === 'institution' && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                      <LayoutDashboard className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  <Link href="/okullar" className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                    <GraduationCap className="header-hamburger-icon" aria-hidden />
                    <span>OKULLAR</span>
                  </Link>
                  <Link href="/about" className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                    <Info className="header-hamburger-icon" aria-hidden />
                    <span>HAKKIMIZDA</span>
                  </Link>
                  <Link href="/contact" className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                    <Phone className="header-hamburger-icon" aria-hidden />
                    <span>İLETİŞİM</span>
                  </Link>
                  <Link href="/faq" className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                    <HelpCircle className="header-hamburger-icon" aria-hidden />
                    <span>S.S.S</span>
                  </Link>
                  {user && shouldShowCTA && userType !== 'institution' && userType !== 'individual' && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                      <User className="header-hamburger-icon" aria-hidden />
                      <span>{getCTALabel()}</span>
                    </Link>
                  )}
                  {user && (
                    <button
                      type="button"
                      className="header-hamburger-link header-hamburger-link-button header-hamburger-link--logout"
                      onClick={() => handleLogout('desktop')}
                    >
                      <LogOut className="header-hamburger-icon" aria-hidden />
                      <span>ÇIKIŞ YAP</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
