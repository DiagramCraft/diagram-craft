import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { IconPicker } from '../../components/IconPicker';
import { slugifyEntityName } from '../../lib/entityEditState';

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string;
  /** When set (even to ''), the dialog also edits a description. */
  initialDescription?: string;
  /** When set (even to null), the dialog also lets the user pick a rail icon. */
  initialIcon?: string | null;
  /**
   * When set, the dialog also edits the URL key. An empty string means "derive it from the name
   * until the user edits it" (used when creating).
   */
  initialKey?: string;
  /** Error from the last attempt (e.g. a key that is already taken). */
  error?: string;
  onConfirm: (name: string, description: string, icon: string | null, key?: string) => void;
  onCancel: () => void;
};

export const DashboardNameDialog = ({
  open,
  title,
  confirmLabel,
  initialName = '',
  initialDescription,
  initialIcon,
  initialKey,
  error,
  onConfirm,
  onCancel
}: Props) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [icon, setIcon] = useState<string | null>(initialIcon ?? null);

  const [key, setKey] = useState<string | null>(initialKey ? initialKey : null);
  const hasKey = initialKey !== undefined;
  const effectiveKey = key ?? slugifyEntityName(name);
  const keyValid = !hasKey || KEY_PATTERN.test(effectiveKey);

  const confirm = () => {
    const value = name.trim();
    if (!value || !keyValid) return;
    onConfirm(value, description.trim(), icon, hasKey ? effectiveKey : undefined);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: confirmLabel,
          type: 'default',
          onClick: confirm,
          disabled: !name.trim() || !keyValid
        }
      ]}
    >
      {error && <div role="alert">{error}</div>}
      <FormElement label="Name" required>
        <TextInput
          value={name}
          onChange={value => setName(value ?? '')}
          placeholder="e.g. Security posture"
          autoFocus
        />
      </FormElement>
      {hasKey && (
        <FormElement
          label="Key"
          required
          hint="Lowercase slug used in URLs. Changing it breaks links that use the old key."
          error={keyValid ? undefined : 'Use lowercase letters, digits and single hyphens'}
        >
          <TextInput value={effectiveKey} onChange={value => setKey(value ?? '')} />
        </FormElement>
      )}
      {initialDescription !== undefined && (
        <FormElement label="Description">
          <TextInput value={description} onChange={value => setDescription(value ?? '')} />
        </FormElement>
      )}
      {initialIcon !== undefined && (
        <FormElement label="Icon">
          <IconPicker value={icon ?? undefined} onChange={value => value && setIcon(value)} />
        </FormElement>
      )}
    </Dialog>
  );
};
