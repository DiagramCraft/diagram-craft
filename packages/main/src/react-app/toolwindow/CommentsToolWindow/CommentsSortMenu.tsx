import { TbArrowsSort, TbCheck, TbChevronRight } from 'react-icons/tb';
import type { GroupBy, SortBy } from './utils';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';

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
    <BaseUIMenu.Root>
      <BaseUIMenu.Trigger
        render={
          <a className={'cmp-button cmp-button--icon-only'}>
            <TbArrowsSort />
          </a>
        }
      />
      <BaseUIMenu.Portal>
        <BaseUIMenu.Positioner align={'end'}>
          <BaseUIMenu.Popup className="cmp-context-menu">
            <BaseUIMenu.SubmenuRoot>
              <BaseUIMenu.SubmenuTrigger className="cmp-context-menu__item">
                Sort by Date
                <div className="cmp-context-menu__right-slot">
                  <TbChevronRight />
                </div>
              </BaseUIMenu.SubmenuTrigger>
              <BaseUIMenu.Portal>
                <BaseUIMenu.Positioner>
                  <BaseUIMenu.Popup className="cmp-context-menu">
                    <BaseUIMenu.CheckboxItem
                      className="cmp-context-menu__item"
                      checked={sortBy === 'date-desc'}
                      onCheckedChange={checked => checked && onSortChange('date-desc')}
                    >
                      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                        <TbCheck />
                      </BaseUIMenu.CheckboxItemIndicator>
                      Newest First
                    </BaseUIMenu.CheckboxItem>
                    <BaseUIMenu.CheckboxItem
                      className="cmp-context-menu__item"
                      checked={sortBy === 'date-asc'}
                      onCheckedChange={checked => checked && onSortChange('date-asc')}
                    >
                      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                        <TbCheck />
                      </BaseUIMenu.CheckboxItemIndicator>
                      Oldest First
                    </BaseUIMenu.CheckboxItem>
                  </BaseUIMenu.Popup>
                </BaseUIMenu.Positioner>
              </BaseUIMenu.Portal>
            </BaseUIMenu.SubmenuRoot>
            <BaseUIMenu.SubmenuRoot>
              <BaseUIMenu.SubmenuTrigger className="cmp-context-menu__item">
                Group by
                <div className="cmp-context-menu__right-slot">
                  <TbChevronRight />
                </div>
              </BaseUIMenu.SubmenuTrigger>
              <BaseUIMenu.Portal>
                <BaseUIMenu.Positioner>
                  <BaseUIMenu.Popup className="cmp-context-menu">
                    <BaseUIMenu.CheckboxItem
                      className="cmp-context-menu__item"
                      checked={groupBy === 'none'}
                      onCheckedChange={checked => checked && onGroupChange('none')}
                    >
                      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                        <TbCheck />
                      </BaseUIMenu.CheckboxItemIndicator>
                      None
                    </BaseUIMenu.CheckboxItem>
                    <BaseUIMenu.CheckboxItem
                      className="cmp-context-menu__item"
                      checked={groupBy === 'element'}
                      onCheckedChange={checked => checked && onGroupChange('element')}
                    >
                      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                        <TbCheck />
                      </BaseUIMenu.CheckboxItemIndicator>
                      Element
                    </BaseUIMenu.CheckboxItem>
                    <BaseUIMenu.CheckboxItem
                      className="cmp-context-menu__item"
                      checked={groupBy === 'author'}
                      onCheckedChange={checked => checked && onGroupChange('author')}
                    >
                      <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                        <TbCheck />
                      </BaseUIMenu.CheckboxItemIndicator>
                      Author
                    </BaseUIMenu.CheckboxItem>
                  </BaseUIMenu.Popup>
                </BaseUIMenu.Positioner>
              </BaseUIMenu.Portal>
            </BaseUIMenu.SubmenuRoot>
            <BaseUIMenu.CheckboxItem
              className="cmp-context-menu__item"
              checked={hideResolved}
              onCheckedChange={onHideResolvedChange}
            >
              <BaseUIMenu.CheckboxItemIndicator className="cmp-context-menu__item-indicator">
                <TbCheck />
              </BaseUIMenu.CheckboxItemIndicator>
              Hide Resolved
            </BaseUIMenu.CheckboxItem>
          </BaseUIMenu.Popup>
        </BaseUIMenu.Positioner>
      </BaseUIMenu.Portal>
    </BaseUIMenu.Root>
  );
};
