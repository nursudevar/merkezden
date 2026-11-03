"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { Button } from "@/components/ui";
import { useTypewriterPlaceholder } from "@/hooks/useTypewriterPlaceholder";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  typewriterPlaceholders?: readonly string[];
  buttonText?: string;
  showButton?: boolean;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Örnek: Kadıköy'de çocuğum için yüzme kursu arıyorum",
  typewriterPlaceholders,
  buttonText = "🔍 ARA",
  showButton = true,
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const useAnimatedPlaceholder = Boolean(typewriterPlaceholders?.length);
  const showLeadingSearchIcon = useAnimatedPlaceholder;
  const animatedEnabled = useAnimatedPlaceholder && !isFocused && value.length === 0;
  const { text: animatedText } = useTypewriterPlaceholder(
    typewriterPlaceholders ?? [],
    {
      enabled: animatedEnabled,
    },
  );

  const showAnimatedText = animatedEnabled && animatedText.length > 0;

  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={useAnimatedPlaceholder ? "" : placeholder}
      className={`search-bar-input${showLeadingSearchIcon ? " search-bar-input--with-icon" : ""} ${inputClassName}`.trim()}
    />
  );

  return (
    <div className={`search-bar-wrapper ${className}`}>
      {showLeadingSearchIcon ? (
        <div className="search-bar-input-shell">
          {/* eslint-disable-next-line @next/next/no-img-element -- static search icon asset */}
          <img
            src="/images/search-icon.png"
            alt=""
            aria-hidden
            className="search-bar-input-icon"
          />
          {input}
          {showAnimatedText ? (
  <span className="search-bar-animated-placeholder" aria-hidden="true">
    {animatedText}
  </span>
) : null}
        </div>
      ) : (
        input
      )}
      {showButton && (
        <Button className={`search-bar-button ${buttonClassName}`}>
          {buttonText}
        </Button>
      )}
    </div>
  );
}
