
import { useEffect, useState } from "react";

type UseTypewriterPlaceholderOptions = {
  enabled: boolean;
  pauseMs?: number;
};

export type AnimatedPlaceholderState = {
  text: string;
};

const TYPE_SPEED_MS = 35;

export function useTypewriterPlaceholder(
  texts: readonly string[],
  { enabled, pauseMs = 1200 }: UseTypewriterPlaceholderOptions,
): AnimatedPlaceholderState {
  const [state, setState] = useState({
    textIndex: 0,
    charIndex: 0,
  });

  useEffect(() => {
    if (!enabled || texts.length === 0) {
      setState((prev) =>
        prev.textIndex === 0 && prev.charIndex === 0
          ? prev
          : { textIndex: 0, charIndex: 0 }
      );
      return;
    }

    const characters = Array.from(texts[state.textIndex] ?? "");
    const completed = state.charIndex >= characters.length;

    const timeoutId = window.setTimeout(() => {
      if (completed) {
        setState({
          textIndex: (state.textIndex + 1) % texts.length,
          charIndex: 0,
        });
      } else {
        setState((prev) => ({
          ...prev,
          charIndex: prev.charIndex + 1,
        }));
      }
    }, completed ? pauseMs : TYPE_SPEED_MS);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, texts, state, pauseMs]);

  if (!enabled || texts.length === 0) {
    return { text: "" };
  }

  return {
    text: Array.from(texts[state.textIndex] ?? "")
      .slice(0, state.charIndex)
      .join(""),
  };
}
