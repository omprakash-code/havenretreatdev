"use client";

import styles from "./PremiumActionButton.module.css";

type PremiumActionButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  showArrow?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
};

export default function PremiumActionButton({
  label,
  onClick,
  disabled = false,
  showArrow = true,
  className = "",
  type = "button",
}: PremiumActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.button} ${className}`.trim()}
    >
      <span className={styles.dotsBorder} aria-hidden="true" />
      <span className={styles.surface}>
        <span className={styles.content}>
          {label}
          {showArrow && <span className={styles.arrow} aria-hidden="true" />}
        </span>
      </span>
    </button>
  );
}
