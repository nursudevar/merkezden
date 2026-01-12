"use client";

import Link from 'next/link';
import { Button } from '@/components/ui';
import LogoutButton from '@/components/auth/LogoutButton';

interface HeaderClientProps {
  initialUser: { id: string; email?: string } | null;
  initialUserType: 'individual' | 'institution' | null;
}

export default function HeaderClient({
  initialUser,
  initialUserType,
}: HeaderClientProps) {
  const getCTALabel = () => {
    if (initialUserType === 'individual') return 'Profil';
    if (initialUserType === 'institution') return 'Panel';
    return 'Hesap';
  };

  const getCTAHref = () => {
    if (initialUserType === 'individual') return '/profile';
    if (initialUserType === 'institution') return '/institution';
    return '#';
  };

  const shouldShowCTA = initialUserType === 'individual' || initialUserType === 'institution';
  const isDisabled = initialUser && !initialUserType;

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
          <div className="header-actions">
            {initialUser ? (
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
