import { stableHue } from './MemberAvatar';
import styles from './PickedTeamChips.module.css';

/** Removable chips for the teams picked in a team multi-select. */
export const PickedTeamChips = ({
  ids,
  getLabel,
  onRemove,
  spaced
}: {
  ids: string[];
  getLabel: (id: string) => string | undefined;
  onRemove: (id: string) => void;
  /** Adds a small gap above the chips, when they follow a label */
  spaced?: boolean;
}) => {
  if (ids.length === 0) return null;
  return (
    <div className={`${styles.list} ${spaced ? styles.spaced : ''}`}>
      {ids.map(id => (
        <span key={id} className={styles.chip}>
          <span
            className={styles.dot}
            style={{ background: `oklch(0.65 0.15 ${stableHue(id)})` }}
          />
          {getLabel(id) ?? 'Unavailable team'}
          <button
            type="button"
            className={styles.remove}
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
