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
  kind: 'enum' | 'field_group' | 'category';
  itemId: string;
  onClose: () => void;
}) => (
  <VersionHistoryDialog open={open} onClose={onClose}>
    <SnapshotVersionHistorySubSection kind={kind} itemId={itemId} />
  </VersionHistoryDialog>
);
