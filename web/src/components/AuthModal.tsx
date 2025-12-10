"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/pages/auth.scss";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "success" | "error" | "email-exists";
  title: string;
  message: string;
  primaryButtonText: string;
  primaryButtonAction: () => void;
  secondaryButtonText?: string;
  secondaryButtonAction?: () => void;
};

export default function AuthModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  primaryButtonText,
  primaryButtonAction,
  secondaryButtonText,
  secondaryButtonAction,
}: AuthModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handlePrimaryClick = () => {
    primaryButtonAction();
    onClose();
  };

  const handleSecondaryClick = () => {
    if (secondaryButtonAction) {
      secondaryButtonAction();
    }
    onClose();
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">{title}</h2>
        </div>
        <div className="auth-modal-body">
          <p className="auth-modal-message">{message}</p>
        </div>
        <div className="auth-modal-footer">
          <button
            type="button"
            className="auth-modal-button auth-modal-button-primary"
            onClick={handlePrimaryClick}
          >
            {primaryButtonText}
          </button>
          {secondaryButtonText && (
            <button
              type="button"
              className="auth-modal-button auth-modal-button-secondary"
              onClick={handleSecondaryClick}
            >
              {secondaryButtonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

