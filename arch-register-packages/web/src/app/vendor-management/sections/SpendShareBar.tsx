import styles from './SpendShareBar.module.css';

const pctOf = (amount: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (amount / total) * 100)) : 0;

/**
 * Share-of-total bar for the Spend roll-up tables: a filled track for `amount`'s share of `total`,
 * with the percentage to its right — mirrors `../../strategy-model/sections/CapabilityMaturityBar.tsx`'s
 * track/fill shape, but unbanded (a single accent color) since spend share isn't a severity signal
 * the way capability maturity is. Local to this screen — no shared `ProgressBar` component exists
 * yet (see `CapabilityMaturityBar.tsx`'s own comment for the other, private, precedent).
 */
export const SpendShareBar = ({ amount, total }: { amount: number; total: number }) => {
  const pct = pctOf(amount, total);
  return (
    <span className={styles.cell}>
      <span className={styles.track} title={`${pct.toFixed(1)}% of total spend`}>
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </span>
      <span className={`${styles.pct} mono tabular dim`}>{pct.toFixed(0)}%</span>
    </span>
  );
};
