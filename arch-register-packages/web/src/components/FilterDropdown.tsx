import { TbChevronDown } from 'react-icons/tb';
import styles from './FilterDropdown.module.css';

type Option = { value: string; label: string };

type FilterDropdownProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  variant?: 'default' | 'secondary';
};

export const FilterDropdown = ({
  label,
  value,
  onChange,
  options,
  variant
}: FilterDropdownProps) => (
  <div className={styles.cFilterDropdown} data-variant={variant ?? 'default'}>
    <span className={styles.eLabel}>{label}</span>
    <span className={styles.eValue}>{options.find(o => o.value === value)?.label ?? value}</span>
    <TbChevronDown size={10} />
    <select className={styles.eSelect} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
