import styles from './TypeBadge.module.css';
import { resolveIcon } from '../lib/icons';

type TypeBadgeProps = {
  color: string;
  name?: string;
  size?: number;
  icon?: string | null;
  hideBorder?: boolean;
};

export const TypeBadge = ({ color, name, size = 18, icon, hideBorder }: TypeBadgeProps) => {
  const IconComponent = resolveIcon(icon);

  if (hideBorder) {
    return (
      <span
        title={name}
        style={{
          color: color
        }}
      >
        <IconComponent size={size} />
      </span>
    );
  } else {
    const iconSize = Math.round(size * 0.66);
    return (
      <span
        className={styles.badge}
        title={name}
        style={{
          width: size,
          height: size,
          background: `color-mix(in oklch, ${color} 22%, transparent)`,
          color: color,
          borderColor: `color-mix(in oklch, ${color} 40%, transparent)`
        }}
      >
        <IconComponent size={iconSize} />
      </span>
    );
  }
};
