import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { Select } from '../components/Select.tsx';
import { TbDots } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useElementProperty } from './useProperty.ts';
import { newid } from '../../utils/id.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { isEdge, isNode } from '../../model/diagramElement.ts';

export const StylesheetPanel = (props: Props) => {
  const $d = useDiagram();

  const stylesheet = useElementProperty($d, 'style', 'default');

  // TODO: Handle if stylesheet has multiple values

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
            value={stylesheet.val}
            values={$d.document.styles.nodeStyles.map(e => ({
              value: e.id,
              label: e.name
            }))}
            onValueChange={v => {
              stylesheet.set(v);
            }}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={'cmp-button'}>
                <TbDots />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    const uow = new UnitOfWork($d, true);
                    $d.selectionState.elements.forEach(n => {
                      if (isNode(n)) {
                        $d.document.styles.applyNodeProps(n, stylesheet.val, uow);
                      } else if (isEdge(n)) {
                        $d.document.styles.applyEdgeProps(n, stylesheet.val, uow);
                      }
                    });
                    commitWithUndo(uow, 'Reapply style');
                  }}
                >
                  Reapply
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    const style = $d.document.styles.nodeStyles.find(s => s.id === stylesheet.val);
                    if (style) {
                      style.props = $d.selectionState.nodes[0].props as Partial<NodeProps>;
                    }
                    $d.update();
                  }}
                >
                  Redefine from current
                </DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">Delete</DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">Modify</DropdownMenu.Item>
                <DropdownMenu.Item className="cmp-context-menu__item">Rename</DropdownMenu.Item>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    const id = newid();
                    $d.document.styles.nodeStyles.push({
                      id: id,
                      name: 'New style: ' + id,

                      // TODO: Should get common props across selection
                      props: $d.selectionState.nodes[0].propsForEditing as Partial<NodeProps>
                    });

                    const uow = new UnitOfWork($d, true);
                    $d.document.styles.applyNodeProps($d.selectionState.nodes[0], id, uow);
                    commitWithUndo(uow, 'New style');
                  }}
                >
                  Add new
                </DropdownMenu.Item>
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
