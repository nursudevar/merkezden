"use client";

import { useCallback, useEffect, useState } from "react";

export type ProfileContactRevealKind = "call" | "mail";

function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function useProfileContactReveal(phone: string, email: string) {
  const [revealed, setRevealed] = useState<ProfileContactRevealKind | null>(null);
  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();

  useEffect(() => {
    if (!revealed) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".institution-profile-card")) return;
      setRevealed(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setRevealed(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [revealed]);

  const onCallClick = useCallback(() => {
    if (!trimmedPhone) return;
    if (revealed === "call") {
      window.location.href = toTelHref(trimmedPhone);
      return;
    }
    setRevealed("call");
  }, [revealed, trimmedPhone]);

  const onMailClick = useCallback(() => {
    if (!trimmedEmail) return;
    if (revealed === "mail") {
      window.location.href = `mailto:${trimmedEmail}`;
      return;
    }
    setRevealed("mail");
  }, [revealed, trimmedEmail]);

  return {
    revealed,
    phone: trimmedPhone,
    email: trimmedEmail,
    callDisabled: !trimmedPhone,
    mailDisabled: !trimmedEmail,
    callLabel: revealed === "call" && trimmedPhone ? trimmedPhone : "Beni Arayın",
    mailLabel: revealed === "mail" && trimmedEmail ? trimmedEmail : "Mail Gönder",
    onCallClick,
    onMailClick,
  };
}
