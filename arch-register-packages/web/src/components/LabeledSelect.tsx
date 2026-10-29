import { TbChevronDown } from 'react-icons/tb';
import controlStyles from './LabeledControl.module.css';
import styles from './LabeledSelect.module.css';

type Option = { value: string; label: string };

export type OptionGroup = { label: string; options: Option[] };

type LabeledSelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  variant?: 'default' | 'secondary';
  disabled?: boolean;
} & ({ options: Option[]; groups?: never } | { groups: OptionGroup[]; options?: never });

const renderOption = (o: Option) => (
  <option key={o.value} value={o.value}>
    {o.label}
  </option>
);

export const LabeledSelect = ({
  label,
  value,
  onChange,
  options,
  groups,
  variant,
  disabled = false
}: LabeledSelectProps) => {
  const allOptions = options ?? groups.flatMap(g => g.options);
  return (
    <div
      className={`${controlStyles.cLabeledControl} ${styles.cLabeledSelect}`}
      data-variant={variant ?? 'default'}
      data-disabled={disabled || undefined}
    >
      <span className={controlStyles.eLabel}>{label}</span>
      <span className={styles.eValue}>
        {allOptions.find(o => o.value === value)?.label ?? value}
      </span>
      <TbChevronDown size={10} />
      <select
        className={styles.eSelect}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
      >
        {options
          ? options.map(renderOption)
          : groups
              .filter(g => g.options.length > 0)
              .map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(renderOption)}
                </optgroup>
              ))}
      </select>
    </div>
  );
};
