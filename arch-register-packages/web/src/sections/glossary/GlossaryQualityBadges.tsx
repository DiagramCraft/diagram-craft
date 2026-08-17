import { TbAlertTriangle, TbEyeOff, TbHistory, TbUserOff } from 'react-icons/tb';
import type { GlossaryTerm } from '@arch-register/api-types/glossaryContract';
import styles from './GlossaryScreen.module.css';

export const GlossaryQualityBadges = ({ quality }: { quality: GlossaryTerm['quality'] }) => {
  const badges: { icon: typeof TbAlertTriangle; title: string }[] = [];
  if (quality.conflicting) {
    badges.push({ icon: TbAlertTriangle, title: "Conflicts with another term's name or alias" });
  }
  if (quality.deprecated) {
    badges.push({ icon: TbHistory, title: 'Deprecated lifecycle' });
  }
  if (quality.ownerless) {
    badges.push({ icon: TbUserOff, title: 'No owner assigned' });
  }
  if (quality.unused) {
    badges.push({ icon: TbEyeOff, title: 'No visible usage found' });
  }

  if (badges.length === 0) return null;

  return (
    <span className={styles.qualityBadges}>
      {badges.map(({ icon: Icon, title }) => (
        <span key={title} className={styles.qualityBadge} title={title}>
          <Icon size={12} />
        </span>
      ))}
    </span>
  );
};
