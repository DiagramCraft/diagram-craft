import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbChevronRight, TbDots } from 'react-icons/tb';
import type { QueryType } from '@diagram-craft/model/documentProps';
import { useApplication, useDocument } from '../../../application';
import { useCallback } from 'react';
import { useRedraw } from '../../hooks/useRedraw';

type SearchToolMenuProps = {
  type: QueryType;
  onQuerySelect: (scope: string, query: string) => void;
  getLabel: () => string;
  getQuery: () => string;
  getScope: () => string;
};

export const SearchToolMenu = (props: SearchToolMenuProps) => {
  const application = useApplication();
  const redraw = useRedraw();
  const document = useDocument();
  const history = document.props.query.history.filter(h => h.type === props.type);
  const saved = document.props.query.saved.filter(r => r.type === props.type);

  const saveSearch = useCallback(() => {
    application.ui.showDialog({
      id: 'stringInput',
      props: {
        title: 'Save search',
        value: props.getLabel(),
        description:
          'Enter a name for this search. This will be used to identify the search in the saved searches list.',
        label: 'Name',
        saveButtonLabel: 'Save',
        type: 'string'
      },
      onOk: value => {
        const query = props.getQuery();
        const scope = props.getScope();
        document.props.query.addSaved(props.type, value, scope, query);
        redraw();
      }
    });
  }, [props.getQuery]);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <a className={'cmp-button cmp-button--icon-only'}>
          <TbDots />
        </a>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" align={'start'}>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              className="cmp-context-menu__item"
              disabled={history.length === 0}
            >
              Recent Searches
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                {history.map(({ scope, value, label }) => (
                  <DropdownMenu.Item
                    key={value}
                    className="cmp-context-menu__item"
                    onClick={() => props.onQuerySelect(scope, value)}
                  >
                    {label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              className="cmp-context-menu__item"
              disabled={saved.length === 0}
            >
              Saved Searches
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu">
                {saved.map(({ scope, value, label }) => (
                  <DropdownMenu.Item
                    key={value}
                    className="cmp-context-menu__item"
                    onClick={() => props.onQuerySelect(scope, value)}
                  >
                    {label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className="cmp-context-menu__item" onClick={saveSearch}>
            Save Search
          </DropdownMenu.Item>
          <DropdownMenu.Item className="cmp-context-menu__item">
            Manage Saved Searches
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="cmp-context-menu__separator" />
          {props.type !== 'djql' && (
            <DropdownMenu.Item className="cmp-context-menu__item">
              Convert to DJQL
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className="cmp-context-menu__item">
            Create Rule Layer
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
