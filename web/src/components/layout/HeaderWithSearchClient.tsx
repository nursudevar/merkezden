"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import LogoutButton from '@/components/auth/LogoutButton';
import SearchBar from '@/components/SearchBar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface HeaderWithSearchClientProps {
  user: { id: string; email?: string } | null;
  userType: 'individual' | 'institution' | null;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
  showSearchButton?: boolean;
}

export default function HeaderWithSearchClient({
  user,
  userType,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
  showSearchButton = true,
}: HeaderWithSearchClientProps) {
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

  const handleMobileLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
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
                  <Link href="/okullar" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                    Tüm Okullar
                  </Link>
                  {user ? (
                    <>
                      {shouldShowCTA && (
                        <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                          {getCTALabel()}
                        </Link>
                      )}
                      <button type="button" className="header-hamburger-link header-hamburger-link-button" onClick={handleMobileLogout}>
                        Çıkış Yap
                      </button>
                    </>
                  ) : (
                    <Link href="/login" className="header-hamburger-link" onClick={() => setMenuOpen(false)}>
                      Giriş Yap
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
                <div className="header-actions-auth">
                  <LogoutButton />
                </div>
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
                  <Link href="/okullar" className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                    OKULLAR
                  </Link>
                  {user && shouldShowCTA && (
                    <Link href={getCTAHref()} className="header-hamburger-link" onClick={() => setDesktopMenuOpen(false)}>
                      {getCTALabel()}
                    </Link>
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
