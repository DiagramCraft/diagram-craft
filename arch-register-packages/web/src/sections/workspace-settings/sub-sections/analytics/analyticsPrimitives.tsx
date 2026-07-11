import styles from './WorkspaceAnalyticsScreen.module.css';

export const formatPercent = (value: number) => `${value.toFixed(1)}%`;

export const StatCard = ({
  label,
  value,
  sub
}: {
  label: string;
  value: string | number;
  sub: string;
}) => (
  <div className={styles.card}>
    <div className={styles.cardLabel}>{label}</div>
    <div className={styles.cardValue}>{value}</div>
    <div className={styles.cardSub}>{sub}</div>
  </div>
);

export type BarBucket = {
  count: number;
  percent: number;
  color: string | null;
  label?: string;
  onClick?: () => void;
};

export const StackedBar = ({ buckets }: { buckets: BarBucket[] }) => {
  const visible = buckets.filter(b => b.count > 0);

  if (visible.length === 0) return <div className={styles.bar} />;

  const stops: string[] = [];
  const positions: number[] = [];
  let pos = 0;
  for (let i = 0; i < visible.length; i++) {
    const bucket = visible[i]!;
    const color = bucket.color ?? '#c7ced6';
    const isFirst = i === 0;
    const isLast = i === visible.length - 1;
    positions.push(pos);
    const end = Math.min(pos + bucket.percent, 100);
    stops.push(isFirst ? `${color} 0%` : `${color} calc(${pos}% + 1px)`);
    if (isLast) {
      stops.push(`${color} 100%`);
    } else {
      stops.push(
        `${color} calc(${end}% - 1px)`,
        `var(--base-bg) calc(${end}% - 1px)`,
        `var(--base-bg) calc(${end}% + 1px)`
      );
    }
    pos = end;
  }

  return (
    <div
      className={styles.bar}
      style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
    >
      {visible.map((bucket, index) => (
        <div
          key={bucket.label ?? index}
          role={bucket.onClick ? 'button' : undefined}
          tabIndex={bucket.onClick ? 0 : undefined}
          onClick={bucket.onClick}
          onKeyDown={
            bucket.onClick
              ? e => {
                  if (e.key === 'Enter' || e.key === ' ') bucket.onClick?.();
                }
              : undefined
          }
          className={styles.barOverlay}
          style={{
            left: `${positions[index]}%`,
            width: `${bucket.percent}%`,
            cursor: bucket.onClick ? 'pointer' : undefined
          }}
          title={
            bucket.label
              ? `${bucket.label}: ${bucket.count} (${bucket.percent.toFixed(1)}%)`
              : undefined
          }
        />
      ))}
    </div>
  );
};

export const Section = ({
  title,
  sub,
  children
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) => (
  <section className={styles.section}>
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitle}>{title}</div>
      <div className={styles.sectionSub}>{sub}</div>
    </div>
    {children}
  </section>
);

export const EmptyState = ({ text }: { text: string }) => <div className={styles.empty}>{text}</div>;
