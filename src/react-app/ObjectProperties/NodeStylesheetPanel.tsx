import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { Select } from '../components/Select.tsx';
import { TbDots } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDiagram } from '../context/DiagramContext.tsx';

export const NodeStylesheetPanel = (props: Props) => {
  const $d = useDiagram();
  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stylesheet"
      title={'Styles'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Styles:</div>
        <div className={'cmp-labeled-table__value util-hstack'}>
          <Select
            value={'default'}
            values={$d.document.styles.nodeStyles.map(e => ({
              value: e.id,
              label: e.name
            }))}
            onValueChange={() => {}}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={'cmp-button'}>
                <TbDots />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                <DropdownMenu.Item className="cmp-context-menu__item">Reapply</DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">
                  Redefine from current
                </DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">Delete</DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">Modify</DropdownMenu.Item>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />
                <DropdownMenu.Item className="cmp-context-menu__item">Add new</DropdownMenu.Item>
                <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
