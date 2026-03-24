import HeaderClientWrapper from '@/components/layout/HeaderClientWrapper';

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

