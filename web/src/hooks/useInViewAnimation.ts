import { useEffect, useRef, useState } from "react";

export function useInViewAnimation(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // We want the animation to trigger every time it enters
          // and reset when it leaves, so scrolling up re-animates.
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.2,
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return { ref, isVisible };
}

