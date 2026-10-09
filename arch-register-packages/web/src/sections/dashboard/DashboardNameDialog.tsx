import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { APP_ICON_NAMES, resolveAppIcon } from '../../shell/appIcons';

type Props = {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialName?: string;
  /** When set (even to ''), the dialog also edits a description. */
  initialDescription?: string;
  /** When set (even to null), the dialog also lets the user pick a rail icon. */
  initialIcon?: string | null;
  onConfirm: (name: string, description: string, icon: string | null) => void;
  onCancel: () => void;
};

export const DashboardNameDialog = ({
  open,
  title,
  confirmLabel,
  initialName = '',
  initialDescription,
  initialIcon,
  onConfirm,
  onCancel
}: Props) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [icon, setIcon] = useState<string | null>(initialIcon ?? null);

  const confirm = () => {
    const value = name.trim();
    if (!value) return;
    onConfirm(value, description.trim(), icon);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        { label: confirmLabel, type: 'default', onClick: confirm, disabled: !name.trim() }
      ]}
    >
      <FormElement label="Name" required>
        <TextInput
          value={name}
          onChange={value => setName(value ?? '')}
          placeholder="e.g. Security posture"
          autoFocus
        />
      </FormElement>
      {initialDescription !== undefined && (
        <FormElement label="Description">
          <TextInput value={description} onChange={value => setDescription(value ?? '')} />
        </FormElement>
      )}
      {initialIcon !== undefined && (
        <FormElement label="Icon">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {APP_ICON_NAMES.map(candidate => {
              const Icon = resolveAppIcon(candidate);
              return (
                <button
                  key={candidate}
                  type="button"
                  aria-pressed={icon === candidate}
                  aria-label={candidate.replace(/^Tb/, '')}
                  title={candidate.replace(/^Tb/, '')}
                  onClick={() => setIcon(candidate)}
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border: `1px solid ${icon === candidate ? 'var(--accent, currentColor)' : 'transparent'}`,
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </FormElement>
      )}
    </Dialog>
  );
};
