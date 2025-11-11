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
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { useApplication, useDiagram } from '../../../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { ElementStylesheetDialog } from './ElementStylesheetDialog';
import { NodeTextEditor } from '../../components/RuleEditorDialog/NodeTextEditor';
import { useState } from 'react';
import { EDGE_EDITORS, NODE_EDITORS } from '../../components/RuleEditorDialog/editors';

const EDITORS = {
  text: [{ name: 'Text', editor: NodeTextEditor }],
  node: [
    { name: 'Fill', editor: NODE_EDITORS['fill'].editor },
    { name: 'Stroke', editor: NODE_EDITORS['stroke'].editor },
    { name: 'Shadow', editor: NODE_EDITORS['shadow'].editor },
    { name: 'Effects', editor: NODE_EDITORS['effects'].editor },
    { name: 'Custom', editor: NODE_EDITORS['nodeCustom'].editor },
    { name: 'Advanced', editor: NODE_EDITORS['advanced'].editor },
    { name: 'Action', editor: NODE_EDITORS['action'].editor }
  ],
  edge: [
    { name: 'Line', editor: EDGE_EDITORS['edgeLine'].editor },
    { name: 'Shadow', editor: EDGE_EDITORS['shadow'].editor },
    { name: 'Effects', editor: EDGE_EDITORS['edgeEffects'].editor },
    { name: 'Custom', editor: EDGE_EDITORS['edgeCustom'].editor }
  ]
};

export const ElementStylesheetPanel = (props: Props) => {
  const $d = useDiagram();
  const application = useApplication();
  const redraw = useRedraw();

  const [dialogProps, setDialogProps] = useState<
    | undefined
    | {
        props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps;
        style: Stylesheet<'text'> | Stylesheet<'node'> | Stylesheet<'edge'>;
      }
  >(undefined);

  const isText = props.type === 'text';

  useEventListener($d.selection, 'change', redraw);
  useEventListener($d, 'diagramChange', redraw);

  const style = useElementMetadata($d, 'style', DefaultStyles.node.default);
  const textStyle = useElementMetadata($d, 'textStyle', DefaultStyles.text.default);

  if ($d.selection.isEmpty()) return null;
  if ($d.selection.type === 'mixed') return null;

  const isDirty = isText
    ? !textStyle.hasMultipleValues && isSelectionDirty($d, true)
    : !style.hasMultipleValues && isSelectionDirty($d, false);

  const styleList = isText
    ? $d.document.styles.textStyles
    : $d.selection.isNodesOnly()
      ? $d.document.styles.nodeStyles
      : $d.document.styles.edgeStyles;

  const $s = isText ? textStyle : style;

  return (
    <>
      <ToolWindowPanel
        mode={
          (props.mode ?? ($d.selection.isNodesOnly() || $d.selection.isEdgesOnly()))
            ? 'headless'
            : 'accordion'
        }
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
                $d.selection.elements.forEach(n => {
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
                <button type="button" className={'cmp-button'}>
                  <TbDots />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                  <DropdownMenu.Item
                    className="cmp-context-menu__item"
                    onSelect={() => {
                      const uow = new UnitOfWork($d, true);
                      $d.selection.elements.forEach(n => {
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
                          $d.selection.elements.map(e => e.editProps)
                        ) as DiagramCraft.NodeProps & DiagramCraft.EdgeProps;
                        stylesheet.setProps(
                          isText ? { text: commonProps.text } : commonProps,
                          $d.document.styles,
                          uow
                        );
                        $d.document.styles.reapplyStylesheet(stylesheet, uow);
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
                              $d.selection.elements.map(e => e.editProps)
                            ) as DiagramCraft.NodeProps & DiagramCraft.EdgeProps;
                            const s = Stylesheet.fromSnapshot(
                              isText ? 'text' : isNode($d.selection.elements[0]) ? 'node' : 'edge',
                              {
                                id,
                                name: v,
                                props: {
                                  ...(isText ? { text: commonProps.text } : commonProps)
                                }
                              },
                              $d.document.styles.crdt.factory
                            );
                            const uow = new UnitOfWork($d, true);

                            $d.document.styles.addStylesheet(s.id, s, uow);
                            $d.document.styles.setStylesheet(
                              $d.selection.elements[0]!,
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
                      setDialogProps({
                        props: style?.props ?? {},
                        style: style!
                      });
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
                            stylesheet.setName(v, $d.document.styles, uow);
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
      {dialogProps && (
        <ElementStylesheetDialog
          open={!!dialogProps}
          props={dialogProps.props}
          type={dialogProps.style.type}
          onClose={() => setDialogProps(undefined)}
          onSave={e => {
            const style = dialogProps.style;

            const uow = new UnitOfWork($d, true);
            const stylesheet = $d.document.styles.get(style.id);
            if (stylesheet) {
              stylesheet.setProps(e, $d.document.styles, uow);
              commitWithUndo(uow, 'Modify style');
            } else {
              uow.abort();
            }

            setDialogProps(undefined);
          }}
          editors={EDITORS[dialogProps.style.type]}
        />
      )}
    </>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
  type: StylesheetType;
};
