import { Chip } from '../../components/Chip';
import { useDateTimeFormatPreference } from '../../hooks/useDateTimeFormatPreference';
import { formatDateTime } from '../../utils/dateFormat';

export const UserStatusChip = ({
  isSystemActor,
  isActive,
  lockedUntil
}: {
  isSystemActor: boolean;
  isActive: boolean;
  lockedUntil?: string | null;
}) => {
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  return isActive && !isSystemActor && lockedUntil != null && new Date(lockedUntil) > new Date() ? (
    <Chip
      tone="ghost"
      dot="var(--error-fg)"
      title={`Sign-in locked until ${formatDateTime(lockedUntil, '—', dateTimeFormatPreference)}`}
    >
      Locked
    </Chip>
  ) : isSystemActor ? (
    <Chip tone="ghost" dot="var(--cmp-fg-disabled)">
      System
    </Chip>
  ) : (
    <Chip tone="ghost" dot={isActive ? 'var(--green)' : 'var(--cmp-fg-disabled)'}>
      {isActive ? 'Active' : 'Inactive'}
    </Chip>
  );
};
