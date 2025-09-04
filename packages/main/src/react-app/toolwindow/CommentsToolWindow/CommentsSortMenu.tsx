import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbArrowsSort, TbCheck, TbChevronRight } from 'react-icons/tb';
import type { GroupBy, SortBy } from './utils';

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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <a className={'cmp-button cmp-button--icon-only'}>
          <TbArrowsSort />
        </a>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" side="left">
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="cmp-context-menu__item">
              Sort by Date
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                <DropdownMenu.CheckboxItem
                  className="cmp-context-menu__item"
                  checked={sortBy === 'date-desc'}
                  onCheckedChange={checked => checked && onSortChange('date-desc')}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-indicator"
                    forceMount={true}
                  >
                    <TbCheck />
                  </DropdownMenu.ItemIndicator>
                  Newest First
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  className="cmp-context-menu__item"
                  checked={sortBy === 'date-asc'}
                  onCheckedChange={checked => checked && onSortChange('date-asc')}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-indicator"
                    forceMount={true}
                  >
                    <TbCheck />
                  </DropdownMenu.ItemIndicator>
                  Oldest First
                </DropdownMenu.CheckboxItem>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="cmp-context-menu__item">
              Group by
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                <DropdownMenu.CheckboxItem
                  className="cmp-context-menu__item"
                  checked={groupBy === 'none'}
                  onCheckedChange={checked => checked && onGroupChange('none')}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-indicator"
                    forceMount={true}
                  >
                    <TbCheck />
                  </DropdownMenu.ItemIndicator>
                  None
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  className="cmp-context-menu__item"
                  checked={groupBy === 'element'}
                  onCheckedChange={checked => checked && onGroupChange('element')}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-indicator"
                    forceMount={true}
                  >
                    <TbCheck />
                  </DropdownMenu.ItemIndicator>
                  Element
                </DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem
                  className="cmp-context-menu__item"
                  checked={groupBy === 'author'}
                  onCheckedChange={checked => checked && onGroupChange('author')}
                >
                  <DropdownMenu.ItemIndicator
                    className="cmp-context-menu__item-indicator"
                    forceMount={true}
                  >
                    <TbCheck />
                  </DropdownMenu.ItemIndicator>
                  Author
                </DropdownMenu.CheckboxItem>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.CheckboxItem
            className="cmp-context-menu__item"
            checked={hideResolved}
            onCheckedChange={onHideResolvedChange}
          >
            <DropdownMenu.ItemIndicator
              className="cmp-context-menu__item-indicator"
              forceMount={true}
            >
              <TbCheck />
            </DropdownMenu.ItemIndicator>
            Hide Resolved
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
