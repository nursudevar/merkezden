"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import "@/styles/components/login-modal.scss";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-body">
          <p className="login-modal-message">Lütfen giriş yapınız</p>
        </div>
        <div className="login-modal-footer">
          <Button onClick={onClose} className="login-modal-button">
            Tamam
          </Button>
        </div>
      </div>
    </div>
  );
}
