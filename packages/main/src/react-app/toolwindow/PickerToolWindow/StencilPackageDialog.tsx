import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { useEffect, useState } from 'react';

export type StencilPackageOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  packages: ReadonlyArray<StencilPackageOption>;
  activePackageIds: ReadonlyArray<string>;
  onSave: (ids: string[]) => void;
};

export const StencilPackageDialog = ({
  open,
  onClose,
  packages,
  activePackageIds,
  onSave
}: Props) => {
  const [draft, setDraft] = useState<string[]>(activePackageIds as string[]);

  useEffect(() => {
    if (!open) return;
    setDraft([...activePackageIds]);
  }, [activePackageIds, open]);

  const toggle = (id: string, checked: boolean) => {
    setDraft(current => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter(currentId => currentId !== id);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={'Stencil packages'}
      buttons={[
        {
          label: 'Cancel',
          type: 'cancel',
          onClick: () => onClose()
        },
        {
          label: 'Save',
          type: 'default',
          onClick: () => {
            onSave(draft);
            onClose();
          }
        }
      ]}
    >
      <div style={{ minWidth: '20rem' }}>
        <div
          className={'util-vstack'}
          style={{ gap: '0.75rem', maxHeight: '22rem', overflowY: 'auto', paddingRight: '0.25rem' }}
        >
          {packages.map(pkg => (
            <label
              key={pkg.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <Checkbox
                value={draft.includes(pkg.id)}
                onChange={checked => toggle(pkg.id, !!checked)}
              />
              <span>{pkg.name}</span>
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
