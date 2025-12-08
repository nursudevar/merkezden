"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function HeroAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const item1Ref = useRef<HTMLDivElement>(null);
  const item2Ref = useRef<HTMLDivElement>(null);
  const item3Ref = useRef<HTMLDivElement>(null);
  const item4Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = [item1Ref.current, item2Ref.current, item3Ref.current, item4Ref.current].filter(
      (item): item is HTMLDivElement => item !== null
    );

    if (items.length === 0) return;

    // Set initial state
    gsap.set(items, {
      opacity: 0,
      y: 30,
      scale: 0.9,
    });

    // Create timeline
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 });

    // Animate each element sequentially
    items.forEach((element, index) => {
      tl.to(
        element,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "power2.out",
        },
        index * 0.2
      ).to(
        element,
        {
          opacity: 0,
          y: -20,
          scale: 0.95,
          duration: 0.4,
          ease: "power2.in",
        },
        `+=${2 - index * 0.1}`
      );
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="hero-animation-container" ref={containerRef}>
      <div className="hero-animation-item" ref={item1Ref}>
        <span className="hero-animation-icon">🎓</span>
        <span className="hero-animation-text">Eğitim</span>
      </div>
      <div className="hero-animation-item" ref={item2Ref}>
        <span className="hero-animation-icon">⚽</span>
        <span className="hero-animation-text">Spor</span>
      </div>
      <div className="hero-animation-item" ref={item3Ref}>
        <span className="hero-animation-icon">🎨</span>
        <span className="hero-animation-text">Sanat</span>
      </div>
      <div className="hero-animation-item" ref={item4Ref}>
        <span className="hero-animation-icon">🌍</span>
        <span className="hero-animation-text">Dil</span>
      </div>
    </div>
  );
}

