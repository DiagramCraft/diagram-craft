import {
  TbAlertTriangle,
  TbCheck,
  TbClock,
  TbEye,
  TbInfoCircle,
  TbListSearch,
  TbLock,
  TbSparkles
} from 'react-icons/tb';
import type {
  ConformanceCheckDefinition,
  ConformanceCheckStatus,
  ConformanceSeverity
} from '@arch-register/api-types/conformanceContract';
import { Chip } from './Chip';
import styles from './ConformanceBadges.module.css';

type CheckType = ConformanceCheckDefinition['type'];

export const CHECK_TYPE_META: Record<
  CheckType,
  { label: string; description: string; icon: typeof TbClock }
> = {
  scheduled_validation: {
    label: 'Scheduled validation',
    description: 'Evaluate a validation expression against every entity of a schema.',
    icon: TbClock
  },
  query_policy: {
    label: 'Query policy',
    description: 'Identify entities matching a saved query.',
    icon: TbListSearch
  },
  ai_prompt: {
    label: 'AI prompt',
    description: 'AI-assisted yes/no conformance check on selected fields.',
    icon: TbSparkles
  }
};

export const SEVERITY_META: Record<
  ConformanceSeverity,
  { icon: typeof TbAlertTriangle; color: string; label: string }
> = {
  error: { icon: TbAlertTriangle, color: 'var(--error-fg)', label: 'Error' },
  warning: { icon: TbInfoCircle, color: 'var(--warning-fg)', label: 'Warning' }
};

export const SeverityBadge = ({ severity }: { severity: ConformanceSeverity }) => {
  const meta = SEVERITY_META[severity];
  const SeverityIcon = meta.icon;
  return (
    <span className={styles.severityBadge} style={{ color: meta.color }}>
      <SeverityIcon size={12} /> {meta.label}
    </span>
  );
};

export const STATUS_META: Record<
  ConformanceCheckStatus,
  { icon: typeof TbAlertTriangle; dot: string; label: string }
> = {
  active: { icon: TbAlertTriangle, dot: 'var(--error-fg)', label: 'Active' },
  acknowledged: { icon: TbEye, dot: 'var(--cmp-fg-disabled)', label: 'Acknowledged' },
  resolved: { icon: TbCheck, dot: 'var(--success-fg, var(--green-9))', label: 'Resolved' },
  exempt: { icon: TbLock, dot: 'var(--accent-fg)', label: 'Exempt' }
};

export const ViolationStatusChip = ({ status }: { status: ConformanceCheckStatus }) => {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  return (
    <Chip tone="ghost" dot={meta.dot} icon={<StatusIcon size={11} />}>
      {meta.label}
    </Chip>
  );
};
