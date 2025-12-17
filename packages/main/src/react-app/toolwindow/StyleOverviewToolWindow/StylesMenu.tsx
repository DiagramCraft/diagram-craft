import { TbFilterStar } from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import type { StyleScope } from './stylesPanelUtils';

type Props = {
  scope: StyleScope;
  onScopeChange: (scope: StyleScope) => void;
};

export const StylesMenu = ({ scope, onScopeChange }: Props) => {
  return (
    <MenuButton.Root>
      <MenuButton.Trigger className={'cmp-button cmp-button--icon-only'}>
        <TbFilterStar />
      </MenuButton.Trigger>
      <MenuButton.Menu>
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
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
