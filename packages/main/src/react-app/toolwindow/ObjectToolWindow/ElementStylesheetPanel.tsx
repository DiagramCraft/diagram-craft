import {
  getCommonProps,
  isSelectionDirty,
  Stylesheet,
  StylesheetType
} from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isNode } from '@diagram-craft/model/diagramElement';
import { newid } from '@diagram-craft/utils/id';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useElementMetadata } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Select } from '@diagram-craft/app-components/Select';
import { TbDots } from 'react-icons/tb';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { useApplication, useDiagram } from '../../../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { StringInputDialogCommand } from '@diagram-craft/canvas-app/dialogs';
import { ElementStylesheetDialog, STYLESHEET_EDITORS } from './ElementStylesheetDialog';
import { useState } from 'react';
import type { EdgeProps, NodeProps } from '@diagram-craft/model/diagramProps';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

export const ElementStylesheetPanel = (props: Props) => {
  const $d = useDiagram();
  const application = useApplication();
  const redraw = useRedraw();

  const [dialogProps, setDialogProps] = useState<
    | undefined
    | {
        props: NodeProps | EdgeProps;
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
                UnitOfWork.executeWithUndo($d, 'Change stylesheet', uow => {
                  $d.selection.elements.forEach(n => {
                    $d.document.styles.setStylesheet(n, v!, uow, true);
                  });
                  $s.set(v);
                });
              }}
            >
              {styleList.map(e => (
                <Select.Item key={e.id} value={e.id}>
                  {isDirty && e.id === $s.val ? `${e.name} ∗` : e.name}
                </Select.Item>
              ))}
            </Select.Root>
            <MenuButton.Root>
              <MenuButton.Trigger>
                <TbDots />
              </MenuButton.Trigger>

              <MenuButton.Menu>
                <Menu.Item
                  onClick={() => {
                    UnitOfWork.executeWithUndo($d, 'Reapply style', uow => {
                      $d.selection.elements.forEach(n => {
                        $d.document.styles.setStylesheet(n, $s.val, uow, true);
                      });
                    });
                  }}
                >
                  Reset
                </Menu.Item>
                <Menu.Item
                  onClick={() => {
                    // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
                    UnitOfWork.executeWithUndo($d, 'Redefine style', uow => {
                      const stylesheet = $d.document.styles.get($s.val);
                      if (stylesheet) {
                        const commonProps = getCommonProps(
                          $d.selection.elements.map(e => e.editProps)
                        ) as NodeProps & EdgeProps;
                        stylesheet.setProps(isText ? { text: commonProps.text } : commonProps, uow);
                        $d.document.styles.reapplyStylesheet(stylesheet, uow);
                      }
                    });
                  }}
                >
                  Save
                </Menu.Item>
                <Menu.Item
                  onClick={() => {
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
                          ) as NodeProps & EdgeProps;
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

                          UnitOfWork.executeWithUndo($d, 'Add style', uow => {
                            $d.document.styles.addStylesheet(s.id, s, uow);
                            $d.document.styles.setStylesheet(
                              $d.selection.elements[0]!,
                              id,
                              uow,
                              true
                            );
                          });
                        }
                      )
                    );
                  }}
                >
                  Save As...
                </Menu.Item>
                <Menu.Item
                  onClick={() => {
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
                          UnitOfWork.executeWithUndo($d, 'Delete style', uow => {
                            $d.document.styles.deleteStylesheet($s.val, uow);
                          });
                        }
                      )
                    );
                  }}
                >
                  Delete
                </Menu.Item>
                <Menu.Item
                  onClick={() => {
                    const style = $d.document.styles.get($s.val);
                    setDialogProps({
                      props: style?.props ?? {},
                      style: style!
                    });
                  }}
                >
                  Modify
                </Menu.Item>
                <Menu.Item
                  onClick={() => {
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
                          UnitOfWork.executeWithUndo($d, 'Rename style', uow => {
                            const stylesheet = $d.document.styles.get($s.val)!;
                            stylesheet.setName(v, uow);
                          });
                        }
                      )
                    );
                  }}
                >
                  Rename
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
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

            const stylesheet = $d.document.styles.get(style.id);
            if (stylesheet) {
              UnitOfWork.executeWithUndo($d, 'Modify style', uow => {
                stylesheet.setProps(e, uow);
              });
            }

            setDialogProps(undefined);
          }}
          editors={STYLESHEET_EDITORS[dialogProps.style.type]}
        />
      )}
    </>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
  type: StylesheetType;
};
