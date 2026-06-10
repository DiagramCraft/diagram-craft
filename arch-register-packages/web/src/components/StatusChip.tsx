import { Chip } from './Chip';
import { WorkspaceLifecycleState } from '@arch-register/api-types/workspaces';

type StatusChipProps = {
  value: string;
  lifecycleStates?: WorkspaceLifecycleState[];
};

export const StatusChip = ({ value, lifecycleStates }: StatusChipProps) => {
  const fromConfig = lifecycleStates?.find(s => s.id === value);
  const dot = fromConfig?.color ?? 'var(--cmp-fg-disabled)';
  const label = fromConfig?.label ?? value;
  return (
    <Chip dot={dot} tone="ghost">
      {label}
    </Chip>
  );
};
