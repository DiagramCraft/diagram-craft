import { TbArrowBackUp, TbTrash } from 'react-icons/tb';
import { useSchemaDraftState, type SchemaDraftKind } from './useSchemaDraftState';
import { Button } from '@diagram-craft/app-components/Button';
import type { MenuItem } from '../../components/DropdownMenu';
import { TitleMenu } from '../../components/TitleMenu';

/** Overflow (…) menu for an editor's `Title`: optional extra actions, then delete. */
export const EditorActionsMenu = ({
  deleteLabel,
  onDelete,
  extraItems = [],
  draftItem
}: {
  deleteLabel: string;
  onDelete: () => void;
  /** Identifies the edited item so staged changes can be marked and reverted to live. */
  draftItem?: { kind: SchemaDraftKind; id: string };
  /** Additional actions shown above the delete action. */
  extraItems?: MenuItem[];
}) => {
  const schemaDraft = useSchemaDraftState();
  const staged = draftItem ? schemaDraft.itemFor(draftItem.kind, draftItem.id) : undefined;
  return (
    <TitleMenu
      items={[
        ...(staged && draftItem
          ? [
              {
                label: 'Revert to live',
                icon: <TbArrowBackUp size={14} />,
                onClick: () => void schemaDraft.unstage(draftItem.kind, draftItem.id)
              }
            ]
          : []),
        ...extraItems,
        { label: deleteLabel, icon: <TbTrash size={14} />, danger: true, onClick: onDelete }
      ]}
    />
  );
};

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
