"use client";

import { useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";

export default function HeroSearchAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const studentRef = useRef<HTMLDivElement>(null);
  const teacherRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (
      !containerRef.current ||
      !parentRef.current ||
      !studentRef.current ||
      !teacherRef.current
    ) {
      return;
    }

    // Set initial states
    gsap.set(parentRef.current, {
      x: -150,
      opacity: 0,
      scale: 0.8,
      yPercent: -50,
    });

    gsap.set(studentRef.current, {
      x: -150,
      opacity: 0,
      scale: 0.8,
      xPercent: -50,
      yPercent: -50,
    });

    gsap.set(teacherRef.current, {
      x: 150,
      opacity: 0,
      scale: 0.8,
      yPercent: -50,
    });

    // Create timeline
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    timelineRef.current = tl;

    // 1) Animate characters in (parent and student from left with stagger, teacher from right)
    tl.to(
      parentRef.current,
      {
        x: 0,
        opacity: 1,
        scale: 1,
        yPercent: -50,
        duration: 0.7,
        ease: "back.out(1.4)",
      }
    )
      .to(
        studentRef.current,
        {
          x: 0,
          opacity: 1,
          scale: 1,
          xPercent: -50,
          yPercent: -50,
          duration: 0.7,
          ease: "back.out(1.4)",
        },
        "-=0.55"
      )
      .to(
        teacherRef.current,
        {
          x: 0,
          opacity: 1,
          scale: 1,
          yPercent: -50,
          duration: 0.7,
          ease: "back.out(1.4)",
        },
        "-=0.4"
      )
      // 2) Flip/scale one character on X axis (student turns to look)
      .to(
        studentRef.current,
        {
          scaleX: -1,
          duration: 0.4,
          ease: "power2.inOut",
        },
        "+=0.5"
      )
      .to(
        studentRef.current,
        {
          scaleX: 1,
          duration: 0.4,
          ease: "power2.inOut",
        },
        "+=0.3"
      )
      // 3) Animate characters out
      .to(
        parentRef.current,
        {
          x: -150,
          opacity: 0,
          scale: 0.8,
          yPercent: -50,
          duration: 0.5,
          ease: "power2.in",
        },
        "+=0.4"
      )
      .to(
        studentRef.current,
        {
          x: -150,
          opacity: 0,
          scale: 0.8,
          xPercent: -50,
          yPercent: -50,
          duration: 0.5,
          ease: "power2.in",
        },
        "-=0.4"
      )
      .to(
        teacherRef.current,
        {
          x: 150,
          opacity: 0,
          scale: 0.8,
          yPercent: -50,
          duration: 0.5,
          ease: "power2.in",
        },
        "-=0.4"
      );

    return () => {
      tl.kill();
    };
  }, []);

  const handleRestart = () => {
    if (timelineRef.current) {
      timelineRef.current.restart();
    }
  };

  return (
    <div className="hero-search-animation" ref={containerRef}>
      <div
        className="hero-search-animation__character hero-search-animation__character--parent"
        ref={parentRef}
      >
        <img src="/images/hero-parent.svg" alt="Parent character" />
      </div>
      <div
        className="hero-search-animation__character hero-search-animation__character--student"
        ref={studentRef}
      >
        <img src="/images/hero-student.svg" alt="Student character" />
      </div>
      <div
        className="hero-search-animation__character hero-search-animation__character--teacher"
        ref={teacherRef}
      >
        <img src="/images/hero-teacher.svg" alt="Teacher character" />
      </div>
      <button
        className="hero-search-animation__restart"
        ref={restartButtonRef}
        onClick={handleRestart}
        aria-label="Restart animation"
      >
        ↻
      </button>
    </div>
  );
}

