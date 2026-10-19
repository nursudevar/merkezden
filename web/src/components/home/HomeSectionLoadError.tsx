"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";

export function HomeSectionLoadError({
  message,
  loading,
  onRetry,
}: {
  message: string;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="home-load-error" role="alert">
      <AlertCircle className="home-load-error-icon" aria-hidden />
      <p className="home-load-error-text">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="home-load-error-retry"
        onClick={onRetry}
        disabled={loading}
      >
        {loading ? "Yükleniyor..." : "Tekrar Dene"}
      </Button>
    </div>
  );
}
