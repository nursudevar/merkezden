import { HeaderClientWrapper } from '@/components/layout/header.client';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HeaderClientWrapper />
      {children}
    </>
  );
}

