"use client";

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  error = null,
  confirmLabel = "Onayla",
  cancelLabel = "İptal",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const pointerDownOnBackdropRef = useRef(false);

  const handleBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownOnBackdropRef.current = event.target === event.currentTarget;
  }, []);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (pointerDownOnBackdropRef.current && event.target === event.currentTarget) {
        onCancel();
      }
      pointerDownOnBackdropRef.current = false;
    },
    [onCancel]
  );

  if (!open) return null;

  return (
    <div
      className="app-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-confirm-modal-title"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
    >
      <div className="app-modal-content" onClick={(event) => event.stopPropagation()}>
        <h2 id="app-confirm-modal-title" className="app-modal-title">
          {title}
        </h2>
        <div className="app-modal-body">
          <p className="app-modal-message">{message}</p>
          {error ? <p className="app-modal-error">{error}</p> : null}
        </div>
        <div className="app-modal-footer">
          <Button
            type="button"
            variant="outline"
            className="app-modal-btn app-modal-btn--cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="default"
            className="app-modal-btn app-modal-btn--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "İşleniyor..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
