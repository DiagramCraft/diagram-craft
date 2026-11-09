import { ICON_IDS, ICON_MAP } from '../lib/icons';
import styles from './IconPicker.module.css';

type Props = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** When set, shows a first option that clears the selection (e.g. "use the default icon"). */
  noneLabel?: string;
  disabled?: boolean;
};

export const IconPicker = ({ value, onChange, noneLabel, disabled = false }: Props) => (
  <div className={styles.iconPicker}>
    {noneLabel !== undefined && (
      <button
        type="button"
        className={`${styles.none} ${value === undefined ? styles.active : ''}`}
        aria-pressed={value === undefined}
        disabled={disabled}
        onClick={() => onChange(undefined)}
      >
        {noneLabel}
      </button>
    )}
    {ICON_IDS.map(id => {
      const Icon = ICON_MAP[id];
      return (
        <button
          key={id}
          type="button"
          className={`${styles.option} ${value === id ? styles.active : ''}`}
          aria-pressed={value === id}
          aria-label={id}
          title={id}
          disabled={disabled}
          onClick={() => onChange(id)}
        >
          <Icon size={14} />
        </button>
      );
    })}
  </div>
);
