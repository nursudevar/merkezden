import { ReactNode } from 'react';
import '@/styles/components/page-container.scss';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`page-container ${className}`}>
      {children}
    </div>
  );
}

