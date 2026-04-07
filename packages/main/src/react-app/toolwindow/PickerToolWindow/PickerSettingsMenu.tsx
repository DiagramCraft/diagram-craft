import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { TbLayoutGrid, TbLayoutList, TbSettings } from 'react-icons/tb';
import type { PickerViewMode } from '../../../UserState';
import { Button } from '@diagram-craft/app-components/Button';
import { useState } from 'react';

type Props = {
  pickerViewMode: PickerViewMode;
  onPickerViewModeChange: (mode: PickerViewMode) => void;
  onManageStencils: () => void;
};

export const PickerSettingsMenu = ({
  pickerViewMode,
  onPickerViewModeChange,
  onManageStencils
}: Props) => {
  const [open, setOpen] = useState(false);

  const onSelect = (mode: PickerViewMode) => {
    onPickerViewModeChange(mode);
    setOpen(false);
  };

  return (
    <div style={{ marginLeft: '0.25rem' }}>
      <MenuButton.Root open={open} onOpenChange={setOpen}>
        <MenuButton.Trigger
          variant={'icon-only'}
          aria-label={'Open picker settings'}
          element={
            <Button variant={'secondary'}>
              <TbSettings />
            </Button>
          }
        ></MenuButton.Trigger>
        <MenuButton.Menu align={'end'}>
          <Menu.RadioGroup value={pickerViewMode}>
            <Menu.RadioItem
              value={'grid'}
              onClick={() => onSelect('grid')}
              rightSlot={<TbLayoutGrid size={14} />}
            >
              Grid
            </Menu.RadioItem>
            <Menu.RadioItem
              value={'list'}
              onClick={() => onSelect('list')}
              rightSlot={<TbLayoutList size={14} />}
            >
              List
            </Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.Separator />
          <Menu.Item
            onClick={() => {
              onManageStencils();
              setOpen(false);
            }}
          >
            Manage stencil packages
          </Menu.Item>
        </MenuButton.Menu>
      </MenuButton.Root>
    </div>
  );
};
