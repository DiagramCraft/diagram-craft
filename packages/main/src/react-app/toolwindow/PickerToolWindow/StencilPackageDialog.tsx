import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { useEffect, useState } from 'react';
import { Scrollable } from '@diagram-craft/app-components/Scrollable';

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
      if (current.length === 1 && current.includes(id)) {
        return current;
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
        <Scrollable
          style={{
            maxHeight: '30vh'
          }}
        >
          <div className={'util-vstack'} style={{ gap: '0.75rem' }}>
            {packages.map(pkg => (
              <label
                key={pkg.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <Checkbox
                  value={draft.includes(pkg.id)}
                  onChange={checked => toggle(pkg.id, !!checked)}
                  disabled={draft.length === 1 && draft.includes(pkg.id)}
                />
                <span>{pkg.name}</span>
              </label>
            ))}
          </div>
        </Scrollable>
      </div>
    </Dialog>
  );
};
