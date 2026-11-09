import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import styles from './ColorPicker.module.css';

export type ColorOption = {
  value: string;
  label?: string;
  /** CSS color used to paint the swatch when it differs from `value` (e.g. a tint token). */
  swatch?: string;
};

type Props = {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  /** Palette to choose from. Defaults to `SCHEMA_COLORS`. */
  colors?: ReadonlyArray<ColorOption | string>;
  /** When set, shows a first option that clears the selection (calls `onChange(null)`). */
  noneLabel?: string;
  disabled?: boolean;
  size?: 'default' | 'small';
};

export const ColorPicker = ({
  value,
  onChange,
  colors = SCHEMA_COLORS,
  noneLabel,
  disabled = false,
  size = 'default'
}: Props) => (
  <div className={styles.colorPicker}>
    <div className={`${styles.swatches} ${size === 'small' ? styles.swatchesSmall : ''}`}>
      {noneLabel !== undefined && (
        <button
          type="button"
          className={`${styles.swatch} ${styles.none} ${value == null ? styles.selected : ''}`}
          onClick={() => onChange(null)}
          disabled={disabled}
          title={noneLabel}
          aria-label={noneLabel}
          aria-pressed={value == null}
        />
      )}
      {colors.map(c => {
        const option = typeof c === 'string' ? { value: c } : c;
        const label = option.label ?? option.value;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.swatch} ${selected ? styles.selected : ''}`}
            style={{ backgroundColor: option.swatch ?? option.value }}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            title={label}
            aria-label={`Select color ${label}`}
            aria-pressed={selected}
          />
        );
      })}
    </div>
  </div>
);
