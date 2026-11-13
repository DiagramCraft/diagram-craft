import type { SnapshotVersionKind } from '@arch-register/api-types/schemaDraftContract';
import { SnapshotVersionHistorySubSection } from './SnapshotVersionHistorySubSection';
import { VersionHistoryDialog } from './VersionHistoryDialog';

/** Version history of an enum, field group or category, shown in a dialog. */
export const SnapshotVersionHistoryDialog = ({
  open,
  kind,
  itemId,
  onClose
}: {
  open: boolean;
  kind: SnapshotVersionKind;
  itemId: string;
  onClose: () => void;
}) => (
  <VersionHistoryDialog open={open} onClose={onClose}>
    <SnapshotVersionHistorySubSection kind={kind} itemId={itemId} />
  </VersionHistoryDialog>
);
