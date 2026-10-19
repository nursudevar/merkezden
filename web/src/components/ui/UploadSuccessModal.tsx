"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type UploadSuccessModalProps = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export function UploadSuccessModal({ open, message, onClose }: UploadSuccessModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="app-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-success-message"
      onClick={onClose}
    >
      <div
        className="app-modal-content app-modal-content--success"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-modal-success-icon" aria-hidden>
          <CheckCircle size={28} strokeWidth={2} />
        </div>
        <p id="upload-success-message" className="app-modal-success-message">
          {message}
        </p>
        <div className="app-modal-footer app-modal-footer--single">
          <Button
            type="button"
            variant="default"
            className="app-modal-btn app-modal-btn--primary"
            onClick={onClose}
          >
            Tamam
          </Button>
        </div>
      </div>
    </div>
  );
}
