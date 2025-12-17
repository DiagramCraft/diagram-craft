import { TbArrowsSort } from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import type { StyleScope } from './stylesPanelUtils';

type Props = {
  scope: StyleScope;
  onScopeChange: (scope: StyleScope) => void;
};

export const StylesScopeMenu = ({ scope, onScopeChange }: Props) => {
  return (
    <MenuButton.Root>
      <MenuButton.Trigger className={'cmp-button cmp-button--icon-only'}>
        <TbArrowsSort />
      </MenuButton.Trigger>
      <MenuButton.Menu>
        <Menu.SubMenu label={'Scope'}>
          <Menu.CheckboxItem
            checked={scope === 'current-diagram'}
            onCheckedChange={() => onScopeChange('current-diagram')}
          >
            Current Diagram
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={scope === 'entire-document'}
            onCheckedChange={() => onScopeChange('entire-document')}
          >
            Entire Document
          </Menu.CheckboxItem>
        </Menu.SubMenu>
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
