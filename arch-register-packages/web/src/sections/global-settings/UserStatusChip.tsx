import { Chip } from '../../components/Chip';

export const UserStatusChip = ({
  isSystemActor,
  isActive
}: {
  isSystemActor: boolean;
  isActive: boolean;
}) =>
  isSystemActor ? (
    <Chip tone="ghost" dot="var(--cmp-fg-disabled)">
      System
    </Chip>
  ) : (
    <Chip tone="ghost" dot={isActive ? 'var(--green)' : 'var(--cmp-fg-disabled)'}>
      {isActive ? 'Active' : 'Inactive'}
    </Chip>
  );
