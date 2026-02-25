import Link from 'next/link';
import Image from 'next/image';
import { unstable_noStore as noStore } from 'next/cache';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';
import { Button } from '@/components/ui';
import LogoutButton from '@/components/auth/LogoutButton';

export default async function Header() {
  noStore();
  const { user, userType } = await getCurrentUserRole();


  const getCTALabel = () => {
    if (userType === 'institution') return 'YÖNETİM PANELİ';
    return 'PROFİL';
  };

  const getCTAHref = () => {
    if (userType === 'institution') return '/panel';
    return '/profile';
  };

  return (
    <>
      <div className="top-bar" />
      <header className="header">
        <div className="header-container">
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
          <div className="header-actions">
            <Link href="/okullar">
              <Button className="button-primary btn-gradient-primary" variant="default">
                OKULLAR
              </Button>
            </Link>
            {user ? (
              <>
                <Link href={getCTAHref()}>
                  <Button className="button-primary btn-gradient-primary" variant="default">
                    {getCTALabel()}
                  </Button>
                </Link>
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
