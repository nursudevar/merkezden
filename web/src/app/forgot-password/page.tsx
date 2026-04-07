import { HeaderClientWrapper } from '@/components/layout/header.client';
import ForgotPasswordClient from './ForgotPasswordClient';

export default function ForgotPasswordPage() {
  return (
    <div className="page-container">
      <HeaderClientWrapper />
      <ForgotPasswordClient />
    </div>
  );
}
