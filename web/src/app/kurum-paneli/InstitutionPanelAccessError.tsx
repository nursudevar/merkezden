"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HomeSectionLoadError } from "@/components/home/HomeSectionLoadError";

const MESSAGE =
  "Kurum paneli yetkisi doğrulanamadı. Bağlantı sorunu olabilir. Lütfen tekrar deneyin.";

export function InstitutionPanelAccessError() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lockRef = useRef(false);

  useEffect(() => {
    if (!isPending) lockRef.current = false;
  }, [isPending]);

  const retry = () => {
    if (lockRef.current || isPending) return;
    lockRef.current = true;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="auth-check-error">
      <HomeSectionLoadError message={MESSAGE} loading={isPending} onRetry={retry} />
    </div>
  );
}
