import styles from './SpendShareBar.module.css';

const pctOf = (value: number, max: number) =>
  max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

/**
 * Per-row roll-up table bar: `value`'s magnitude relative to `max` (the largest group's spend in
 * the current table, not a share of the portfolio total — the % column carries that). Mirrors
 * `../../strategy-model/sections/CapabilityMaturityBar.tsx`'s track/fill shape, unbanded (a single
 * accent color) since spend magnitude isn't a severity signal the way capability maturity is.
 */
export const SpendShareBar = ({ value, max }: { value: number; max: number }) => (
  <span className={styles.track}>
    <span className={styles.fill} style={{ width: `${pctOf(value, max)}%` }} />
  </span>
);

export type SpendShareSegment = {
  key: string;
  label: string;
  amount: number;
  onClick?: () => void;
};

/**
 * Portfolio-wide share-of-spend strip: one full-width bar with one segment per group (its share of
 * `total`), each a darker tint of the accent color by rank so adjacent segments stay visually
 * distinct without a fixed categorical palette (the number of groups is open-ended — vendors, cost
 * centres — unlike the Strategy Overview's fixed `LEVEL_COLORS`). Mirrors the design reference's
 * `.vm-share` strip.
 */
export const SpendShareStrip = ({
  segments,
  total
}: {
  segments: readonly SpendShareSegment[];
  total: number;
}) => {
  if (total <= 0 || segments.length === 0) return null;
  return (
    <div className={styles.strip}>
      {segments.map((segment, index) => {
        const pct = pctOf(segment.amount, total);
        if (pct <= 0) return null;
        const color = `color-mix(in oklch, var(--accent-fg) ${Math.max(28, 90 - index * 7)}%, var(--cmp-bg))`;
        const title = `${segment.label} · ${pct.toFixed(1)}%`;
        const style = { width: `${pct}%`, background: color };
        return segment.onClick ? (
          <button
            key={segment.key}
            type="button"
            className={styles.stripSeg}
            style={style}
            onClick={segment.onClick}
            title={title}
          />
        ) : (
          <span key={segment.key} className={styles.stripSeg} style={style} title={title} />
        );
      })}
    </div>
  );
};
