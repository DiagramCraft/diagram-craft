import { STATUS_TONE } from '../data';
import { Chip } from './Chip';
import type { WorkspaceLifecycleState } from '../api';

type StatusChipProps = {
  value: string;
  lifecycleStates?: WorkspaceLifecycleState[];
};

export const StatusChip = ({ value, lifecycleStates }: StatusChipProps) => {
  const fromConfig = lifecycleStates?.find(s => s.id === value);
  const dot = fromConfig?.color ?? STATUS_TONE[value]?.dot ?? 'var(--fg-3)';
  const label = fromConfig?.label ?? STATUS_TONE[value]?.label ?? value;
  return (
    <Chip dot={dot} tone="ghost">
      {label}
    </Chip>
  );
};
