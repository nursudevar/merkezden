"use client";

import Link from 'next/link';
import { Button } from '@/components/ui';
import LogoutButton from '@/components/auth/LogoutButton';
import SearchBar from '@/components/SearchBar';

interface HeaderWithSearchClientProps {
  user: { id: string; email?: string } | null;
  userType: 'individual' | 'institution' | null;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
}

export default function HeaderWithSearchClient({
  user,
  userType,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
}: HeaderWithSearchClientProps) {
  const getCTALabel = () => {
    if (userType === 'individual') return 'Profil';
    if (userType === 'institution') return 'Panel';
    return 'Hesap';
  };

  const getCTAHref = () => {
    if (userType === 'individual') return '/profile';
    if (userType === 'institution') return '/institution';
    return '#';
  };

  const shouldShowCTA = userType === 'individual' || userType === 'institution';
  const isDisabled = user && !userType;

  return (
    <>
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
          <div className="header-brand">
            <Link href="/" className="header-title-link">
              <span className="header-title">MERKEZDEN.COM</span>
            </Link>
            <span className="header-subtitle">HAYATIN MERKEZİ</span>
          </div>
          {onSearchChange && (
            <div className="header-search">
              <SearchBar
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder || "Örnek: Kadıköy'de çocuğum için yüzme kursu arıyorum"}
                buttonText={searchButtonText || "ARA"}
              />
            </div>
          )}
          <div className="header-actions">
            {user ? (
              <>
                {shouldShowCTA ? (
                  <Link href={getCTAHref()}>
                    <Button className="button-primary btn-gradient-primary" variant="default">
                      {getCTALabel()}
                    </Button>
                  </Link>
                ) : isDisabled ? (
                  <Button
                    className="button-primary btn-gradient-primary"
                    variant="default"
                    disabled
                  >
                    {getCTALabel()}
                  </Button>
                ) : null}
                <LogoutButton />
              </>
            ) : (
              <Link href="/login">
                <Button className="button-primary btn-gradient-primary" variant="default">
                  GİRİŞ YAP
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
