import { TbArrowsSort } from 'react-icons/tb';
import type { FontScope, FontSortOrder } from './fontsPanelUtils';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

type FontsSortMenuProps = {
  scope: FontScope;
  sortOrder: FontSortOrder;
  onScopeChange: (scope: FontScope) => void;
  onSortOrderChange: (order: FontSortOrder) => void;
};

export const FontsSortMenu = ({
  scope,
  sortOrder,
  onScopeChange,
  onSortOrderChange
}: FontsSortMenuProps) => {
  return (
    <MenuButton.Root>
      <MenuButton.Trigger className={'cmp-button cmp-button--icon-only'}>
        <TbArrowsSort />
      </MenuButton.Trigger>
      <MenuButton.Menu>
        <Menu.SubMenu label={'Sort by'}>
          <Menu.CheckboxItem
            checked={sortOrder === 'count-desc'}
            onCheckedChange={checked => checked && onSortOrderChange('count-desc')}
          >
            Count (High to Low)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'count-asc'}
            onCheckedChange={checked => checked && onSortOrderChange('count-asc')}
          >
            Count (Low to High)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'alpha-asc'}
            onCheckedChange={checked => checked && onSortOrderChange('alpha-asc')}
          >
            Alphabetically (A-Z)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'alpha-desc'}
            onCheckedChange={checked => checked && onSortOrderChange('alpha-desc')}
          >
            Alphabetically (Z-A)
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.SubMenu label={'Scope'}>
          <Menu.CheckboxItem
            checked={scope === 'current-diagram'}
            onCheckedChange={checked => checked && onScopeChange('current-diagram')}
          >
            Current Diagram
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={scope === 'entire-document'}
            onCheckedChange={checked => checked && onScopeChange('entire-document')}
          >
            Entire Document
          </Menu.CheckboxItem>
        </Menu.SubMenu>
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
