import styles from './MemberAvatar.module.css';

export const stableHue = (id: string) => {
  if (!id) return 0;
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
};

const getInitials = (name: string, email: string | null) => {
  const source = name || email || '';
  return source
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
};

export const resolveAvatarBackground = (userId: string, color?: string | null) => {
  if (color) {
    return `linear-gradient(135deg, color-mix(in oklch, ${color} 78%, white 22%), color-mix(in oklch, ${color} 82%, black 18%))`;
  }

  const h = stableHue(userId);
  return `linear-gradient(135deg, oklch(0.52 0.13 ${h}), oklch(0.42 0.10 ${(h + 32) % 360}))`;
};

export const MemberAvatar = ({
  name,
  email,
  userId,
  color,
  size = 28,
}: {
  name: string | null;
  email: string | null;
  userId: string;
  color?: string | null;
  size?: number;
}) => {
  const initials = getInitials(name ?? '', email);
  const background = resolveAvatarBackground(userId, color);

  return (
    <span className={styles.wrap}>
      <span
        className={styles.avatar}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, Math.round(size * 0.38)),
          background,
        }}
      >
        {initials}
      </span>
      <span className={styles.tooltip}>
        {name && <span className={styles.tooltipName}>{name}</span>}
        {email && <span className={styles.tooltipEmail}>{email}</span>}
        <span className={styles.tooltipId}>{userId}</span>
      </span>
    </span>
  );
};
