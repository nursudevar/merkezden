"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_UPDATE_SUCCESS_MESSAGE = "Şifreniz başarıyla güncellendi.";
const PASSWORD_UPDATE_ERROR_MESSAGE = "Şifre güncellenemedi. Lütfen tekrar deneyin.";
const PASSWORD_VERIFY_ERROR_MESSAGE =
  "Mevcut şifreniz hatalı. Lütfen kontrol edip tekrar deneyin.";
const PASSWORD_SESSION_ERROR_MESSAGE = "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.";
const PASSWORD_UNEXPECTED_ERROR_MESSAGE = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";

type ChangePasswordFieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

type ChangePasswordCardProps = {
  className?: string;
};

export function ChangePasswordCard({ className = "" }: ChangePasswordCardProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const fieldBaseId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof ChangePasswordFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = (): ChangePasswordFieldErrors => {
    const errors: ChangePasswordFieldErrors = {};

    if (!currentPassword.trim()) {
      errors.currentPassword = "Mevcut şifre zorunludur.";
    }

    if (!newPassword.trim()) {
      errors.newPassword = "Yeni şifre zorunludur.";
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Yeni şifreniz en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
    } else if (newPassword === currentPassword) {
      errors.newPassword = "Yeni şifre mevcut şifre ile aynı olamaz.";
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = "Yeni şifre tekrarı zorunludur.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Şifreler birbiriyle eşleşmiyor.";
    }

    return errors;
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    console.log("[ChangePasswordCard] submit started");
    setSubmitError(null);
    setSubmitSuccess(null);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("[change-password] get user error:", userError);
        setSubmitError(PASSWORD_SESSION_ERROR_MESSAGE);
        return;
      }

      const currentUser = userData.user;
      const email = currentUser?.email?.trim();
      if (!currentUser || !email) {
        setSubmitError(PASSWORD_SESSION_ERROR_MESSAGE);
        return;
      }
      console.log("[ChangePasswordCard] user email:", email);

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (verifyError) {
        console.log("[ChangePasswordCard] current password verification failed");
        setSubmitError(PASSWORD_VERIFY_ERROR_MESSAGE);
        setSubmitSuccess(null);
        return;
      }
      console.log("[ChangePasswordCard] current password verified");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.log("[ChangePasswordCard] password update failed", updateError);
        console.error("[change-password] update error:", updateError);
        setSubmitError(PASSWORD_UPDATE_ERROR_MESSAGE);
        return;
      }

      resetForm();
      setSubmitSuccess(PASSWORD_UPDATE_SUCCESS_MESSAGE);
      console.log("[ChangePasswordCard] password update success");
    } catch (error) {
      console.error("[change-password] unexpected error:", error);
      setSubmitError(PASSWORD_UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
      console.log("[ChangePasswordCard] submit finished");
    }
  };

  const classes = ["change-password-card", className].filter(Boolean).join(" ");

  return (
    <Card className={classes}>
      <CardHeader className="change-password-card-header">
        <CardTitle className="change-password-card-title">Şifre Değiştir</CardTitle>
      </CardHeader>
      <CardContent className="change-password-card-content">
        {submitError ? (
          <p className="change-password-card-message change-password-card-message--error" role="alert">
            {submitError}
          </p>
        ) : null}
        {submitSuccess ? (
          <p className="change-password-card-message" role="status">
            {submitSuccess}
          </p>
        ) : null}

        <form className="change-password-card-form" onSubmit={handleSubmit} noValidate>
          <div className="change-password-card-field">
            <label className="change-password-card-label" htmlFor={`${fieldBaseId}-current-password`}>
              Mevcut Şifre
            </label>
            <Input
              id={`${fieldBaseId}-current-password`}
              type="password"
              autoComplete="current-password"
              className="change-password-card-input"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                clearFieldError("currentPassword");
                if (submitError) setSubmitError(null);
                if (submitSuccess) setSubmitSuccess(null);
              }}
              aria-invalid={fieldErrors.currentPassword ? "true" : "false"}
              disabled={isSubmitting}
            />
            {fieldErrors.currentPassword ? (
              <p className="change-password-card-field-error" role="alert">
                {fieldErrors.currentPassword}
              </p>
            ) : null}
          </div>

          <div className="change-password-card-field">
            <label className="change-password-card-label" htmlFor={`${fieldBaseId}-new-password`}>
              Yeni Şifre
            </label>
            <Input
              id={`${fieldBaseId}-new-password`}
              type="password"
              autoComplete="new-password"
              className="change-password-card-input"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                clearFieldError("newPassword");
                clearFieldError("confirmPassword");
                if (submitError) setSubmitError(null);
                if (submitSuccess) setSubmitSuccess(null);
              }}
              aria-invalid={fieldErrors.newPassword ? "true" : "false"}
              disabled={isSubmitting}
            />
            {fieldErrors.newPassword ? (
              <p className="change-password-card-field-error" role="alert">
                {fieldErrors.newPassword}
              </p>
            ) : null}
          </div>

          <div className="change-password-card-field">
            <label className="change-password-card-label" htmlFor={`${fieldBaseId}-confirm-password`}>
              Yeni Şifre Tekrarı
            </label>
            <Input
              id={`${fieldBaseId}-confirm-password`}
              type="password"
              autoComplete="new-password"
              className="change-password-card-input"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearFieldError("confirmPassword");
                if (submitError) setSubmitError(null);
                if (submitSuccess) setSubmitSuccess(null);
              }}
              aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
              disabled={isSubmitting}
            />
            {fieldErrors.confirmPassword ? (
              <p className="change-password-card-field-error" role="alert">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>

          <div className="change-password-card-actions">
            <Button
              type="submit"
              variant="default"
              className="change-password-card-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
