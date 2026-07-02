import { TbHistory, TbGitBranch, TbX } from 'react-icons/tb';
import type { AsOfMarker } from './timeline/TimelineStrip';
import styles from './AsOfBanner.module.css';

type AsOfBannerProps = {
  asOf: string;
  onExit: () => void;
  markers?: AsOfMarker[];
};

export const AsOfBanner = ({ asOf, onExit, markers = [] }: AsOfBannerProps) => {
  const date = new Date(asOf);
  const isFuture = date.getTime() > Date.now();
  const formatted = Number.isNaN(date.getTime())
    ? asOf
    : date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

  const appliedChanges = markers
    .filter(m => m.type === 'future_update' && m.date <= asOf)
    .reduce((sum, m) => sum + m.count, 0);
  const meta = isFuture
    ? appliedChanges > 0
      ? `${appliedChanges} planned change${appliedChanges !== 1 ? 's' : ''} applied over baseline`
      : 'No planned changes yet applied'
    : 'Showing entity state as of this date';

  return (
    <div className={`${styles.banner} ${isFuture ? styles.future : styles.past}`}>
      <span className={styles.icon}>
        {isFuture ? <TbGitBranch size={13} /> : <TbHistory size={13} />}
      </span>
      <span className={styles.mode}>{isFuture ? 'Future projection' : 'Historical snapshot'}</span>
      <span className={styles.sep} />
      <span className={styles.date}>{formatted}</span>
      <span className={styles.sep} />
      <span className={styles.meta}>{meta}</span>
      <span className={styles.sep} />
      <span className={styles.ro}>Read-only</span>
      <button type="button" className={styles.exit} onClick={onExit}>
        <TbX size={10} /> Exit snapshot
      </button>
    </div>
  );
};
