import { TbClock, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import styles from './AsOfBanner.module.css';

type AsOfBannerProps = {
  asOf: string;
  onExit: () => void;
  limitationNote?: string;
};

export const AsOfBanner = ({ asOf, onExit, limitationNote }: AsOfBannerProps) => {
  const date = new Date(asOf);
  const isFuture = date.getTime() > Date.now();
  const formatted = Number.isNaN(date.getTime())
    ? asOf
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className={`${styles.banner} ${isFuture ? styles.future : styles.past}`}>
      <span className={styles.icon}>
        <TbClock size={14} />
      </span>
      <span className={styles.text}>
        Viewing a read-only {isFuture ? 'projected future' : 'historical'} snapshot as of{' '}
        <strong>{formatted}</strong>.
        {limitationNote && <span className={styles.limitation}> {limitationNote}</span>}
      </span>
      <Button size="sm" variant="secondary" icon={<TbX size={12} />} onClick={onExit}>
        Exit snapshot view
      </Button>
    </div>
  );
};
