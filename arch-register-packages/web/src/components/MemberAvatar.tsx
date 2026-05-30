import styles from './MemberAvatar.module.css';

export const stableHue = (id: string) => {
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

export const MemberAvatar = ({
  name,
  email,
  userId,
  size = 28,
}: {
  name: string;
  email: string | null;
  userId: string;
  size?: number;
}) => {
  const h = stableHue(userId);
  const initials = getInitials(name, email);

  return (
    <span className={styles.wrap}>
      <span
        className={styles.avatar}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, Math.round(size * 0.38)),
          background: `linear-gradient(135deg, oklch(0.52 0.13 ${h}), oklch(0.42 0.10 ${(h + 32) % 360}))`,
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
