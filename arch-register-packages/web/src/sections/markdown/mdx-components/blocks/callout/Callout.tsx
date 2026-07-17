import type { ReactNode } from 'react';
import {
  TbAlertOctagon,
  TbAlertTriangle,
  TbCircleCheck,
  TbInfoCircle,
  TbNote
} from 'react-icons/tb';
import { CALLOUT_VARIANTS, type CalloutVariant } from './types';
import styles from './Callout.module.css';

const VARIANT_ICONS: Record<CalloutVariant, ReactNode> = {
  info: <TbInfoCircle size={18} />,
  warning: <TbAlertTriangle size={18} />,
  danger: <TbAlertOctagon size={18} />,
  success: <TbCircleCheck size={18} />,
  note: <TbNote size={18} />
};

const variantClass = (variant: CalloutVariant): string | undefined => {
  if (variant === 'warning') return styles.warning;
  if (variant === 'danger') return styles.danger;
  if (variant === 'success') return styles.success;
  if (variant === 'note') return styles.note;
  return styles.info;
};

const normalizeVariant = (variant?: string): CalloutVariant =>
  (CALLOUT_VARIANTS as readonly string[]).includes(variant ?? '')
    ? (variant as CalloutVariant)
    : 'info';

export const Callout = ({ variant, children }: { variant?: string; children?: ReactNode }) => {
  const resolvedVariant = normalizeVariant(variant);

  return (
    <div className={`${styles.container} ${variantClass(resolvedVariant)}`}>
      <div className={styles.icon}>{VARIANT_ICONS[resolvedVariant]}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
};
