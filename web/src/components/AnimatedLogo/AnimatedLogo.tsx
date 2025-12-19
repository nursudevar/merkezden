import Link from "next/link";
import styles from "./AnimatedLogo.module.scss";

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
  return (
    <Link href={href} className={styles.link} aria-label={label}>
      <span
        className={styles.wrap}
        aria-label={label}
        data-loop={loop ? "true" : "false"}
      >
        <span className={styles.container}>
          <span className={styles.letterM}>
            M
            <svg
              className={styles.sparkle}
              viewBox="0 0 24 24"
              focusable="false"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff4d79" />
                  <stop offset="33.33%" stopColor="#ff6aa7" />
                  <stop offset="66.66%" stopColor="#22b9cf" />
                  <stop offset="100%" stopColor="#ff4d79" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l2.2 6.2L20.5 12l-6.3 3.8L12 22l-2.2-6.2L3.5 12l6.3-3.8L12 2z"
                fill="url(#sparkle-gradient)"
              />
            </svg>
          </span>
          <span className={styles.wordRest}>
            <span className={styles.wordMask}>ERKEZDEN</span>
          </span>
          <span className={styles.dotWrap}>
            <span className={styles.dot} />
          </span>
          <span className={styles.suffix}>COM</span>
        </span>
      </span>
    </Link>
  );
}
