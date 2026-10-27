import { Dialog } from '@diagram-craft/app-components/Dialog';

type Props = {
  open: boolean;
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const CloneEntityDialog = ({ open, entityName, onConfirm, onCancel }: Props) => (
  <Dialog
    open={open}
    onClose={onCancel}
    title="Clone entity?"
    width={440}
    buttons={[
      { label: 'Cancel', type: 'cancel', onClick: onCancel },
      { label: 'Clone entity', type: 'default', onClick: onConfirm }
    ]}
  >
    <p style={{ margin: 0 }}>
      A new entity named <b>{entityName} (copy)</b> will be created with the same properties and
      references as <b>{entityName}</b>.
    </p>
    <p style={{ margin: '8px 0 0', color: 'var(--base-fg-more-dim)' }}>
      Typed relations, change history and diagram memberships are not copied. You will be taken to
      the new entity afterwards.
    </p>
  </Dialog>
);
