import { TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { MenuItem } from '../../components/DropdownMenu';
import { TitleMenu } from '../../components/TitleMenu';

/** Overflow (…) menu for an editor's `Title`: optional extra actions, then delete. */
export const EditorActionsMenu = ({
  deleteLabel,
  onDelete,
  extraItems = []
}: {
  deleteLabel: string;
  onDelete: () => void;
  /** Additional actions shown above the delete action. */
  extraItems?: MenuItem[];
}) => (
  <TitleMenu
    items={[
      ...extraItems,
      { label: deleteLabel, icon: <TbTrash size={14} />, danger: true, onClick: onDelete }
    ]}
  />
);

/**
 * Cancel + Save buttons for an editor's `Title`: always visible, enabled only when there is
 * something to save or discard.
 */
export const EditorSaveButtons = ({
  canSave,
  dirty,
  pending,
  onSave,
  onCancel
}: {
  canSave: boolean;
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <>
    <Button disabled={!dirty || pending} onClick={onCancel}>
      Cancel
    </Button>
    <Button variant="primary" disabled={!canSave || pending} onClick={onSave}>
      {pending ? 'Saving...' : 'Save'}
    </Button>
  </>
);
