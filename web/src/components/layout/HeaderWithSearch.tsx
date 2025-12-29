"use client";

import Link from 'next/link';
import HeaderActions from './HeaderActions';
import SearchBar from '@/components/SearchBar';
import type { User } from '@supabase/supabase-js';

interface HeaderWithSearchProps {
  initialUser: User | null;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchButtonText?: string;
}

export default function HeaderWithSearch({
  initialUser,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchButtonText,
}: HeaderWithSearchProps) {
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
          <HeaderActions initialUser={initialUser} />
        </div>
      </header>
    </>
  );
}

