"use client";

import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

type AppNoticeBarVariant = "info" | "warning" | "error";

export function AppNoticeBar({
  message,
  onDismiss,
  autoHideMs = 6000,
  variant = "info",
}: {
  message: string | null;
  onDismiss: () => void;
  autoHideMs?: number;
  variant?: AppNoticeBarVariant;
}) {
  useEffect(() => {
    if (!message || autoHideMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, autoHideMs, onDismiss]);

  if (!message) return null;

  return (
    <div className={`app-notice-bar app-notice-bar--${variant}`} role="alert" aria-live="polite">
      <div className="app-notice-bar-inner">
        <AlertCircle className="app-notice-bar-icon" aria-hidden />
        <p className="app-notice-bar-text">{message}</p>
        <button type="button" className="app-notice-bar-close" onClick={onDismiss} aria-label="Kapat">
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
