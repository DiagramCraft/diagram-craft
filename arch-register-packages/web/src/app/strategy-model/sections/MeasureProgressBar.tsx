import styles from './MeasureProgressBar.module.css';

const numOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const strOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Baseline → current → target progress bar for a Measure, ported from the design reference's
 * `.bcm-measure` markup in `BCMStrategy` (`bcm-views.jsx`). Progress is the current value's
 * position on the baseline→target span, clamped to 0–100; a zero span (baseline === target)
 * renders as 0. The `direction` field (`up-is-better` / `down-is-better`) is not reflected in the
 * fill — the span math already points the bar the right way — but colours the fill green past 60%
 * of the way to target, amber below, matching the reference. Local to the Strategy section; no
 * shared `ProgressBar` component exists yet (`CapabilityMaturityBar` is the sibling precedent).
 */
export const MeasureProgressBar = ({
  baseline,
  current,
  target,
  unit
}: {
  baseline: unknown;
  current: unknown;
  target: unknown;
  unit: unknown;
}) => {
  const b = numOrNull(baseline);
  const c = numOrNull(current);
  const t = numOrNull(target);
  const u = strOrEmpty(unit);

  if (b == null || c == null || t == null) {
    return <span className="dim">—</span>;
  }

  const span = t - b;
  const progress = span === 0 ? 0 : Math.max(0, Math.min(100, (100 * (c - b)) / span));

  return (
    <span className={styles.row}>
      <span className={styles.muted} title="Baseline — value when the measure was set">
        <span className={styles.tag}>base</span> {b}
        {u}
      </span>
      <span
        className={styles.track}
        title={`Current ${c}${u} — ${progress.toFixed(0)}% of the way from ${b}${u} to target ${t}${u}`}
      >
        <span
          className={styles.fill}
          style={{
            width: `${progress}%`,
            background: progress >= 60 ? 'var(--green)' : 'var(--warning-fg)'
          }}
        />
      </span>
      <span title="Current value">
        <span className={styles.tag}>now</span> {c}
        {u}
      </span>
      <span className={styles.muted} title="Target value">
        <span className={styles.tag}>target</span> {t}
        {u}
      </span>
    </span>
  );
};
