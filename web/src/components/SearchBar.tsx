"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { Button } from "@/components/ui";
import { useTypewriterPlaceholder } from "@/hooks/useTypewriterPlaceholder";
import { HomeSearchSuggestionsPanel } from "@/components/home/HomeSearchSuggestionsPanel";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  typewriterPlaceholders?: readonly string[];
  buttonText?: string;
  showButton?: boolean;
  /** Ana sayfa: focus’ta öneri paneli. */
  enableFocusSuggestions?: boolean;
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
  enableFocusSuggestions = false,
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const suggestionsId = useId();

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
  const showSuggestions =
    enableFocusSuggestions && suggestionsOpen && value.trim().length === 0;

  useEffect(() => {
    if (!showSuggestions) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      setSuggestionsOpen(false);
      setIsFocused(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSuggestionsOpen(false);
      const input = rootRef.current?.querySelector<HTMLInputElement>("input");
      input?.blur();
      setIsFocused(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showSuggestions]);

  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => {
        setIsFocused(true);
        if (enableFocusSuggestions) setSuggestionsOpen(true);
      }}
      onBlur={() => setIsFocused(false)}
      placeholder={useAnimatedPlaceholder ? "" : placeholder}
      className={`search-bar-input${showLeadingSearchIcon ? " search-bar-input--with-icon" : ""} ${inputClassName}`.trim()}
      aria-expanded={enableFocusSuggestions ? showSuggestions : undefined}
      aria-controls={enableFocusSuggestions ? suggestionsId : undefined}
      autoComplete="off"
    />
  );

  return (
    <div
      ref={rootRef}
      className={`search-bar-wrapper${enableFocusSuggestions ? " search-bar-wrapper--suggestions" : ""} ${className}`.trim()}
    >
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
          {showSuggestions ? (
            <div id={suggestionsId}>
              <HomeSearchSuggestionsPanel
                onPopularSearch={(query) => {
                  onChange(query);
                  setSuggestionsOpen(false);
                  setIsFocused(false);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {input}
          {showSuggestions ? (
            <div id={suggestionsId} className="search-bar-suggestions-slot">
              <HomeSearchSuggestionsPanel
                onPopularSearch={(query) => {
                  onChange(query);
                  setSuggestionsOpen(false);
                  setIsFocused(false);
                }}
              />
            </div>
          ) : null}
        </>
      )}
      {showButton && (
        <Button className={`search-bar-button ${buttonClassName}`}>
          {buttonText}
        </Button>
      )}
    </div>
  );
}
