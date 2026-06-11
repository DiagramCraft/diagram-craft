import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import styles from './ColorPicker.module.css';

export const ColorPicker = ({
  value,
  onChange,
  disabled = false,
  size = 'default',
}: {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  size?: 'default' | 'small';
}) => {
  return (
    <div className={styles.colorPicker}>
      <div className={`${styles.swatches} ${size === 'small' ? styles.swatchesSmall : ''}`}>
        {SCHEMA_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`${styles.swatch} ${value === color ? styles.selected : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            disabled={disabled}
            title={color}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
    </div>
  );
};
