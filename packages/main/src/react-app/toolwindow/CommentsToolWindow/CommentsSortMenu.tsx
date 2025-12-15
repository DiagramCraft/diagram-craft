import { TbArrowsSort } from 'react-icons/tb';
import type { GroupBy, SortBy } from './utils';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

type CommentsSortMenuProps = {
  sortBy: SortBy;
  groupBy: GroupBy;
  hideResolved: boolean;
  onSortChange: (sortBy: SortBy) => void;
  onGroupChange: (groupBy: GroupBy) => void;
  onHideResolvedChange: (hideResolved: boolean) => void;
};

export const CommentsSortMenu = ({
  sortBy,
  groupBy,
  hideResolved,
  onSortChange,
  onGroupChange,
  onHideResolvedChange
}: CommentsSortMenuProps) => {
  return (
    <MenuButton.Root>
      <MenuButton.Trigger className={'cmp-button cmp-button--icon-only'}>
        <TbArrowsSort />
      </MenuButton.Trigger>
      <MenuButton.Menu>
        <Menu.SubMenu label={'Sort by Date'}>
          <Menu.CheckboxItem
            className="cmp-context-menu__item"
            checked={sortBy === 'date-desc'}
            onCheckedChange={checked => checked && onSortChange('date-desc')}
          >
            Newest First
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            className="cmp-context-menu__item"
            checked={sortBy === 'date-asc'}
            onCheckedChange={checked => checked && onSortChange('date-asc')}
          >
            Oldest First
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.SubMenu label={'Group by'}>
          <Menu.CheckboxItem
            className="cmp-context-menu__item"
            checked={groupBy === 'none'}
            onCheckedChange={checked => checked && onGroupChange('none')}
          >
            None
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            className="cmp-context-menu__item"
            checked={groupBy === 'element'}
            onCheckedChange={checked => checked && onGroupChange('element')}
          >
            Element
          </Menu.CheckboxItem>
          <Menu.CheckboxItem
            className="cmp-context-menu__item"
            checked={groupBy === 'author'}
            onCheckedChange={checked => checked && onGroupChange('author')}
          >
            Author
          </Menu.CheckboxItem>
        </Menu.SubMenu>
        <Menu.CheckboxItem
          className="cmp-context-menu__item"
          checked={hideResolved}
          onCheckedChange={onHideResolvedChange}
        >
          Hide Resolved
        </Menu.CheckboxItem>
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
