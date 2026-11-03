"use client";

import { Mail, Phone } from "lucide-react";
import { useProfileContactReveal } from "@/hooks/useProfileContactReveal";

type ProfileContactRevealButtonsProps = {
  phone?: string | null;
  email?: string | null;
};

export default function ProfileContactRevealButtons({
  phone = "",
  email = "",
}: ProfileContactRevealButtonsProps) {
  const {
    callDisabled,
    mailDisabled,
    callLabel,
    mailLabel,
    onCallClick,
    onMailClick,
  } = useProfileContactReveal(String(phone ?? ""), String(email ?? ""));

  return (
    <>
      <button
        type="button"
        className="institution-profile-action institution-profile-action--call"
        aria-label={callLabel}
        disabled={callDisabled}
        onClick={onCallClick}
      >
        <Phone size={16} aria-hidden />
        <span>{callLabel}</span>
      </button>
      <button
        type="button"
        className="institution-profile-action institution-profile-action--mail"
        aria-label={mailLabel}
        disabled={mailDisabled}
        onClick={onMailClick}
      >
        <Mail size={16} aria-hidden />
        <span>{mailLabel}</span>
      </button>
    </>
  );
}
