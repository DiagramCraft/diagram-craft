import {
  AddStylesheetUndoableAction,
  DeleteStylesheetUndoableAction,
  getCommonProps,
  isSelectionDirty,
  Stylesheet,
  StylesheetType
} from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo, SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { isNode } from '@diagram-craft/model/diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useElementMetadata } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Select } from '@diagram-craft/app-components/Select';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbDots } from 'react-icons/tb';
import { JSONDialog } from '../../components/JSONDialog';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { useApplication, useDiagram } from '../../../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';

export const ElementStylesheetPanel = (props: Props) => {
  const $d = useDiagram();
  const application = useApplication();
  const redraw = useRedraw();

  const isText = props.type === 'text';

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);

  const style = useElementMetadata($d, 'style', DefaultStyles.node.default);
  const textStyle = useElementMetadata($d, 'textStyle', DefaultStyles.text.default);

  if ($d.selectionState.isEmpty()) return null;
  if ($d.selectionState.getSelectionType() === 'mixed') return null;

  const isDirty = isText
    ? !textStyle.hasMultipleValues && isSelectionDirty($d, true)
    : !style.hasMultipleValues && isSelectionDirty($d, false);

  const styleList = isText
    ? $d.document.styles.textStyles
    : $d.selectionState.isNodesOnly()
      ? $d.document.styles.nodeStyles
      : $d.document.styles.edgeStyles;

  const $s = isText ? textStyle : style;

  return (
    <ToolWindowPanel
      mode={props.mode ?? $d.selectionState.isNodesOnly() ? 'headless' : 'accordion'}
      id="stylesheet"
      title={'Style'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>{isText ? 'Text Style' : 'Style'}:</div>
        <div className={'cmp-labeled-table__value util-hstack'}>
          <Select.Root
            value={$s.val}
            isIndeterminate={$s.hasMultipleValues}
            onChange={v => {
              const uow = new UnitOfWork($d, true);
              $d.selectionState.elements.forEach(n => {
                $d.document.styles.setStylesheet(n, v!, uow, true);
              });
              $s.set(v);
              commitWithUndo(uow, 'Change stylesheet');
            }}
          >
            {styleList.map(e => (
              <Select.Item key={e.id} value={e.id}>
                {isDirty && e.id === $s.val ? `${e.name} ∗` : e.name}
              </Select.Item>
            ))}
          </Select.Root>
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
                      $d.document.styles.setStylesheet(n, $s.val, uow, true);
                    });
                    commitWithUndo(uow, 'Reapply style');
                  }}
                >
                  Reset
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
                    const uow = new UnitOfWork($d, true);
                    const stylesheet = $d.document.styles.get($s.val);
                    if (stylesheet) {
                      const commonProps = getCommonProps(
                        $d.selectionState.elements.map(e => e.editProps)
                      ) as NodeProps & EdgeProps;
                      stylesheet.setProps(isText ? { text: commonProps.text } : commonProps, uow);
                      $d.document.styles.modifyStylesheet(stylesheet, uow);
                    }
                    commitWithUndo(uow, 'Redefine style');
                  }}
                >
                  Save
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    application.ui.showDialog(
                      new StringInputDialogCommand(
                        {
                          label: 'Name',
                          title: 'New style',
                          saveButtonLabel: 'Create',
                          value: ''
                        },
                        v => {
                          const id = newid();
                          const commonProps = getCommonProps(
                            $d.selectionState.elements.map(e => e.editProps)
                          ) as NodeProps & EdgeProps;
                          const s = new Stylesheet(
                            isText
                              ? 'text'
                              : isNode($d.selectionState.elements[0])
                                ? 'node'
                                : 'edge',
                            id,
                            v,
                            {
                              ...(isText ? { text: commonProps.text } : commonProps)
                            }
                          );
                          const uow = new UnitOfWork($d, true);

                          $d.document.styles.addStylesheet(s, uow);
                          $d.document.styles.setStylesheet(
                            $d.selectionState.elements[0],
                            id,
                            uow,
                            true
                          );

                          const snapshots = uow.commit();
                          uow.diagram.undoManager.add(
                            new CompoundUndoableAction([
                              new AddStylesheetUndoableAction(uow.diagram, s),
                              new SnapshotUndoableAction('Delete style', uow.diagram, snapshots)
                            ])
                          );
                        }
                      )
                    );
                  }}
                >
                  Save As...
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    application.ui.showDialog(
                      new MessageDialogCommand(
                        {
                          title: 'Confirm delete',
                          message: 'Are you sure you want to delete this style?',
                          okLabel: 'Yes',
                          okType: 'danger',
                          cancelLabel: 'No'
                        },
                        () => {
                          const uow = new UnitOfWork($d, true);

                          const s = $d.document.styles.get($s.val)!;
                          $d.document.styles.deleteStylesheet($s.val, uow);

                          const snapshots = uow.commit();
                          uow.diagram.undoManager.add(
                            new CompoundUndoableAction([
                              new DeleteStylesheetUndoableAction(uow.diagram, s),
                              new SnapshotUndoableAction('Delete style', uow.diagram, snapshots)
                            ])
                          );
                        }
                      )
                    );
                  }}
                >
                  Delete
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    const style = $d.document.styles.get($s.val);
                    application.ui.showDialog(
                      JSONDialog.create(
                        {
                          title: 'Modify style',
                          label: 'Style definition',
                          data: {
                            props: {
                              ...(style?.props ?? {})
                            }
                          }
                        },
                        e => {
                          // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
                          const uow = new UnitOfWork($d, true);
                          const stylesheet = $d.document.styles.get(style!.id);
                          if (stylesheet) {
                            stylesheet.setProps(e.props, uow);
                            commitWithUndo(uow, 'Modify style');
                          } else {
                            uow.abort();
                          }
                        }
                      )
                    );
                  }}
                >
                  Modify
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    application.ui.showDialog(
                      new StringInputDialogCommand(
                        {
                          label: 'Name',
                          title: 'Rename style',
                          description: 'Enter a new name for the style.',
                          saveButtonLabel: 'Rename',
                          value: $d.document.styles.get($s.val)?.name ?? ''
                        },
                        v => {
                          const uow = new UnitOfWork($d, true);
                          const stylesheet = $d.document.styles.get($s.val)!;
                          stylesheet.setName(v, uow);
                          commitWithUndo(uow, 'Rename style');
                        }
                      )
                    );
                  }}
                >
                  Rename
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
  type: StylesheetType;
};
