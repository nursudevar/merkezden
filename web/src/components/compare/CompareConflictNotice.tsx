"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppNoticeBar } from "@/components/AppNoticeBar";

type CompareConflictNoticeContextValue = {
  showCompareConflictNotice: (message: string) => void;
};

const CompareConflictNoticeContext = createContext<CompareConflictNoticeContextValue | null>(
  null,
);

export function CompareConflictNoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showCompareConflictNotice = useCallback((nextMessage: string) => {
    const trimmed = String(nextMessage ?? "").trim();
    if (!trimmed) return;
    setMessage(trimmed);
  }, []);

  const dismiss = useCallback(() => {
    setMessage(null);
  }, []);

  const value = useMemo(
    () => ({ showCompareConflictNotice }),
    [showCompareConflictNotice],
  );

  return (
    <CompareConflictNoticeContext.Provider value={value}>
      {children}
      <AppNoticeBar message={message} onDismiss={dismiss} variant="warning" />
    </CompareConflictNoticeContext.Provider>
  );
}

export function useCompareConflictNotice(): CompareConflictNoticeContextValue {
  const context = useContext(CompareConflictNoticeContext);
  if (!context) {
    throw new Error("useCompareConflictNotice must be used within CompareConflictNoticeProvider");
  }
  return context;
}

export const COMPARE_CONFLICT_INSTRUCTOR_BLOCKED_MESSAGE =
  "Kurumlar ve eğitmenler birlikte karşılaştırılamaz. Eğitmen karşılaştırması yapmak için önce kurum seçimlerinizi kaldırın.";

export const COMPARE_CONFLICT_INSTITUTION_BLOCKED_MESSAGE =
  "Kurumlar ve eğitmenler birlikte karşılaştırılamaz. Kurum karşılaştırması yapmak için önce eğitmen seçimlerinizi kaldırın.";
