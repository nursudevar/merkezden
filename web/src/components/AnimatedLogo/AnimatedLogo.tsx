import Link from "next/link";
import styles from "./AnimatedLogo.module.css";

type Props = {
  href?: string;
  label?: string;
  loop?: boolean;
};

export default function AnimatedLogo({
  href = "/",
  label = "Merkezden",
  loop = true,
}: Props) {
  const content = (
    <span
      className={styles.wrap}
      aria-label={label}
      data-loop={loop ? "true" : "false"}
    >
      {/* Single stable container with fixed typography */}
      <span className={styles.container}>
        {/* Constant M - never moves, never changes */}
        <span className={styles.letterM}>M</span>

        {/* ERKEZDEN reveal group - single smooth wipe */}
        <span className={styles.wordRest}>
          <span className={styles.wordMask}>ERKEZDEN</span>
        </span>

    

        {/* Full logo dot + pink accent - only visible in full logo phase */}
        <span className={styles.dotWrap}>
          <span className={styles.dot} />
        </span>

        {/* COM suffix - fades in/out */}
        <span className={styles.suffix}>COM</span>
      </span>

      {/* Monogram sparkle - decorative only */}
      <svg
        className={styles.monogramSparkle}
        viewBox="0 0 24 24"
        focusable="false"
        aria-hidden="true"
      >
        <path d="M12 2l2.2 6.2L20.5 12l-6.3 3.8L12 22l-2.2-6.2L3.5 12l6.3-3.8L12 2z" />
      </svg>
    </span>
  );

  return (
    <Link href={href} className={styles.link} aria-label={label}>
      {content}
    </Link>
  );
}
