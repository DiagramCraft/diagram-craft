import { stableHue } from '../../../components/MemberAvatar';
import styles from './PickedTeams.module.css';

export const PickedTeams = ({
  ids,
  labels,
  onRemove
}: {
  ids: string[];
  labels: Map<string, string>;
  onRemove: (id: string) => void;
}) => {
  if (ids.length === 0) return null;
  return (
    <div className={styles.pickedList}>
      {ids.map(id => (
        <span key={id} className={styles.pickedChip}>
          <span
            className={styles.teamDot}
            style={{ background: `oklch(0.65 0.15 ${stableHue(id)})` }}
          />
          {labels.get(id) ?? 'Unavailable team'}
          <button
            type="button"
            className={styles.pickedRemove}
            title="Remove team"
            onClick={() => onRemove(id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
};

