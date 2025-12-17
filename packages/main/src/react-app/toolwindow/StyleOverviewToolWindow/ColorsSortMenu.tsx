import { TbArrowsSort } from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import type { ColorScope, ColorSortOrder, ColorFilter } from './colorsPanelUtils';

type Props = {
  scope: ColorScope;
  sortOrder: ColorSortOrder;
  filter: ColorFilter;
  onScopeChange: (scope: ColorScope) => void;
  onSortOrderChange: (sortOrder: ColorSortOrder) => void;
  onFilterChange: (filter: ColorFilter) => void;
};

export const ColorsSortMenu = ({ scope, sortOrder, filter, onScopeChange, onSortOrderChange, onFilterChange }: Props) => {
  return (
    <MenuButton.Root>
      <MenuButton.Trigger className={'cmp-button cmp-button--icon-only'}>
        <TbArrowsSort />
      </MenuButton.Trigger>
      <MenuButton.Menu>
        <Menu.SubMenu label={'Sort by'}>
          <Menu.CheckboxItem
            checked={sortOrder === 'count-desc'}
            onCheckedChange={() => onSortOrderChange('count-desc')}
          >
            Count (High to Low)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'count-asc'}
            onCheckedChange={() => onSortOrderChange('count-asc')}
          >
            Count (Low to High)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'alpha-asc'}
            onCheckedChange={() => onSortOrderChange('alpha-asc')}
          >
            Color (A-Z)
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={sortOrder === 'alpha-desc'}
            onCheckedChange={() => onSortOrderChange('alpha-desc')}
          >
            Color (Z-A)
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.Separator />
        <Menu.SubMenu label={'Filter'}>
          <Menu.CheckboxItem
            checked={filter === 'all'}
            onCheckedChange={() => onFilterChange('all')}
          >
            All Colors
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={filter === 'background'}
            onCheckedChange={() => onFilterChange('background')}
          >
            Background Only
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={filter === 'text'}
            onCheckedChange={() => onFilterChange('text')}
          >
            Text Only
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            checked={filter === 'border'}
            onCheckedChange={() => onFilterChange('border')}
          >
            Border Only
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.Separator />
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
