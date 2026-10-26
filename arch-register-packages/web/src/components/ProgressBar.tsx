import styles from './ProgressBar.module.css';

/** A thin horizontal progress bar. `percent` is clamped to 0–100. */
export const ProgressBar = ({
  percent,
  height = 4,
  trackColor,
  fillColor,
  className
}: {
  percent: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  /** For layout of the bar itself (width, margins) */
  className?: string;
}) => {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={`${styles.track} ${className ?? ''}`}
      style={{ height, background: trackColor }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div className={styles.fill} style={{ width: `${clamped}%`, background: fillColor }} />
    </div>
  );
};
