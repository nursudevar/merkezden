import { useEffect, useRef, useState } from "react";

type UseTypewriterPlaceholderOptions = {
  enabled: boolean;
  /** Metin tamamen göründükten sonra sonraki metne geçmeden önceki bekleme (ms) */
  pauseMs?: number;
};

/** Karakterler arası stagger — slide-up animasyonu */
export const PLACEHOLDER_SLIDE_STAGGER_MS = 28;
/** Tek karakter slide süresi */
export const PLACEHOLDER_SLIDE_DURATION_MS = 480;

export type AnimatedPlaceholderState = {
  text: string;
  /** Metin değişince animasyonu yeniden başlatmak için */
  cycleKey: number;
};

/**
 * Placeholder metinlerini sırayla döndürür.
 * Eski daktilo efekti kaldırıldı; tam metin + CSS slide-up ile gösterilir.
 * Geçiş zamanlaması: animasyon süresi + stagger + pauseMs.
 */
export function useTypewriterPlaceholder(
  texts: readonly string[],
  { enabled, pauseMs = 100 }: UseTypewriterPlaceholderOptions,
): AnimatedPlaceholderState {
  const [textIndex, setTextIndex] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);
  const textIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled || texts.length === 0) {
      textIndexRef.current = 0;
      setTextIndex(0);
      setCycleKey(0);
      return;
    }

    textIndexRef.current = 0;
    setTextIndex(0);
    setCycleKey((key) => key + 1);

    let timeoutId = 0;

    const scheduleNext = () => {
      const current = texts[textIndexRef.current] ?? "";
      const charCount = Array.from(current).length;
      const revealMs =
        PLACEHOLDER_SLIDE_DURATION_MS +
        Math.max(0, charCount - 1) * PLACEHOLDER_SLIDE_STAGGER_MS;

      timeoutId = window.setTimeout(() => {
        const nextIndex = (textIndexRef.current + 1) % texts.length;
        textIndexRef.current = nextIndex;
        setTextIndex(nextIndex);
        setCycleKey((key) => key + 1);
        scheduleNext();
      }, revealMs + pauseMs);
    };

    scheduleNext();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled, texts, pauseMs]);

  if (!enabled || texts.length === 0) {
    return { text: "", cycleKey: 0 };
  }

  return {
    text: texts[textIndex] ?? "",
    cycleKey,
  };
}
