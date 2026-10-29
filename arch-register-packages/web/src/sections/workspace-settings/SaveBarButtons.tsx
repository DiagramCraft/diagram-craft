import { Button } from '@diagram-craft/app-components/Button';

type SaveBarButtonsProps = {
  dirty: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  /** Extra condition that must hold for saving, e.g. form validity. */
  canSave?: boolean;
};

export const SaveBarButtons = ({
  dirty,
  pending,
  onCancel,
  onSave,
  canSave = true
}: SaveBarButtonsProps) => (
  <>
    <Button disabled={!dirty || pending} onClick={onCancel}>
      Cancel
    </Button>
    <Button
      variant="primary"
      disabled={!dirty || !canSave || pending}
      onClick={() => void onSave()}
    >
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  </>
);
