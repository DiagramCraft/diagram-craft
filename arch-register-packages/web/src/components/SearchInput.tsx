import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { TbSearch, TbX } from 'react-icons/tb';
import styles from './SearchInput.module.css';

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  children?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size' | 'onClear'>;

export const SearchInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, placeholder, onClear, size = 'md', className, children, ...rest }, ref) => {
    const iconSize = size === 'sm' ? 12 : 14;

    return (
      <div className={cx(styles.root, styles[size], className)}>
        <TbSearch size={iconSize} />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          {...rest}
        />
        {onClear && value && (
          <button type="button" className={styles.clearBtn} onClick={onClear} title="Clear">
            <TbX size={11} />
          </button>
        )}
        {children}
      </div>
    );
  }
);
