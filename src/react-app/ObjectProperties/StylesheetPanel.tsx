import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { Select } from '../components/Select.tsx';
import { TbDots } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useElementProperty } from './useProperty.ts';
import { newid } from '../../utils/id.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo, SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { SimpleDialog, SimpleDialogState } from '../components/SimpleDialog.tsx';
import { Dialog } from '../components/Dialog.tsx';
import {
  AddStylesheetUndoableAction,
  DeleteStylesheetUndoableAction,
  getCommonProps,
  isPropsDirty,
  Stylesheet
} from '../../model/diagramStyles.ts';
import { isNode } from '../../model/diagramElement.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { CompoundUndoableAction } from '../../model/undoManager.ts';

const NewStyleDialog = (
  props: Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
    onCreate: (v: string) => void;
  }
) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.isOpen) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });
  return (
    <Dialog
      title={'New style'}
      isOpen={props.isOpen}
      onClose={props.onClose}
      buttons={[
        {
          label: 'Create',
          type: 'default',
          onClick: () => {
            props.onCreate(ref.current!.value);
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      <label>Name:</label>
      <div className={'cmp-text-input'}>
        <input className={'cmp-text-input'} ref={ref} type={'text'} size={40} />
      </div>
    </Dialog>
  );
};

const RenameStyleDialog = (
  props: Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
    stylesheet: Stylesheet | undefined;
    onRename: (v: string) => void;
  }
) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.isOpen) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });
  return (
    <Dialog
      title={'Rename style'}
      isOpen={props.isOpen}
      onClose={props.onClose}
      buttons={[
        {
          label: 'Rename',
          type: 'default',
          onClick: () => {
            props.onRename(ref.current!.value);
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      <label>Name:</label>
      <div className={'cmp-text-input'}>
        <input
          className={'cmp-text-input'}
          ref={ref}
          type={'text'}
          size={40}
          defaultValue={props.stylesheet?.name ?? ''}
        />
      </div>
    </Dialog>
  );
};

const ModifyStyleDialog = (
  props: Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
    stylesheet: Stylesheet<ElementProps> | undefined;
    // eslint-disable-next-line
    onModify: (v: any) => void;
  }
) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.isOpen) {
      setTimeout(() => {
        ref.current?.focus();
      }, 100);
    }
  });
  return (
    <Dialog
      title={'Modify style'}
      isOpen={props.isOpen}
      onClose={props.onClose}
      buttons={[
        {
          label: 'Save',
          type: 'default',
          onClick: () => {
            try {
              JSON.parse(ref.current!.value);
            } catch (e) {
              setError(e?.toString());
              throw e;
            }
            props.onModify(JSON.parse(ref.current!.value));
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      <label>Style definition:</label>
      <div className={'cmp-text-input'}>
        <textarea
          ref={ref}
          rows={30}
          cols={60}
          defaultValue={
            props.stylesheet
              ? JSON.stringify(
                  {
                    props: {
                      ...props.stylesheet.props,
                      highlight: []
                    }
                  },
                  undefined,
                  2
                )
              : ''
          }
        />
      </div>
      {error && <div className={'cmp-text-input__error'}>Error: {error}</div>}
    </Dialog>
  );
};

export const StylesheetPanel = (props: Props) => {
  const $d = useDiagram();
  const redraw = useRedraw();

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);

  const style = useElementProperty($d, 'style', 'default');

  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<SimpleDialogState>(
    SimpleDialog.INITIAL_STATE
  );
  const [newDialog, setNewDialog] = useState(false);
  const [modifyDialog, setModifyDialog] = useState<Stylesheet | undefined>(undefined);
  const [renameDialog, setRenameDialog] = useState<Stylesheet | undefined>(undefined);

  const stylesheet = $d.document.styles.get($d.selectionState.elements[0].props.style!)!;
  const isDirty =
    !style.hasMultipleValues &&
    $d.selectionState.elements.some(e => isPropsDirty(e.props, stylesheet.props));

  const styleList = $d.selectionState.isNodesOnly()
    ? $d.document.styles.nodeStyles
    : $d.document.styles.edgeStyles;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stylesheet"
      title={'Style'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value util-hstack'}>
          <Select
            value={style.val}
            values={styleList.map(e => ({
              value: e.id,
              label: isDirty && e.id === style.val ? `${e.name} ∗` : e.name
            }))}
            hasMultipleValues={style.hasMultipleValues}
            onValueChange={v => {
              style.set(v);
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
                      $d.document.styles.setStylesheet(n, style.val, uow);
                    });
                    commitWithUndo(uow, 'Reapply style');
                  }}
                >
                  Reapply
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
                    const uow = new UnitOfWork($d, true);
                    const stylesheet = $d.document.styles.get(style.val);
                    if (stylesheet) {
                      stylesheet.setProps(
                        getCommonProps($d.selectionState.elements.map(e => e.propsForEditing)) as
                          | NodeProps
                          | EdgeProps,
                        uow
                      );
                      $d.selectionState.elements.forEach(n => {
                        $d.document.styles.setStylesheet(n, style.val, uow);
                      });
                    }
                    commitWithUndo(uow, 'Redefine style');
                  }}
                >
                  Redefine from current
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setConfirmDeleteDialog({
                      isOpen: true,
                      title: 'Confirm delete',
                      message: 'Are you sure you want to delete this style?',
                      buttons: [
                        {
                          label: 'Yes',
                          type: 'danger',
                          onClick: () => {
                            const uow = new UnitOfWork($d, true);

                            const s = $d.document.styles.get(style.val)!;
                            $d.document.styles.deleteStylesheet(style.val, uow);

                            const snapshots = uow.commit();
                            uow.diagram.undoManager.add(
                              new CompoundUndoableAction([
                                new DeleteStylesheetUndoableAction(uow.diagram, s),
                                new SnapshotUndoableAction('Delete style', uow.diagram, snapshots)
                              ])
                            );
                          }
                        },
                        { label: 'No', type: 'cancel', onClick: () => {} }
                      ]
                    });
                  }}
                >
                  Delete
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setModifyDialog($d.document.styles.get(style.val));
                  }}
                >
                  Modify
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setRenameDialog($d.document.styles.get(style.val));
                  }}
                >
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setNewDialog(true);
                  }}
                >
                  Add new
                </DropdownMenu.Item>
                <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <SimpleDialog
            {...confirmDeleteDialog}
            onClose={() => setConfirmDeleteDialog(SimpleDialog.INITIAL_STATE)}
          />
          <NewStyleDialog
            isOpen={newDialog}
            onClose={() => setNewDialog(!newDialog)}
            onCreate={v => {
              const id = newid();
              const s = new Stylesheet(
                isNode($d.selectionState.elements[0]) ? 'node' : 'edge',
                id,
                v,
                {
                  ...(getCommonProps($d.selectionState.elements.map(e => e.propsForEditing)) as
                    | NodeProps
                    | EdgeProps),
                  style: undefined,
                  highlight: []
                }
              );
              const uow = new UnitOfWork($d, true);

              $d.document.styles.addStylesheet(s, uow);
              $d.document.styles.setStylesheet($d.selectionState.nodes[0], id, uow);

              const snapshots = uow.commit();
              uow.diagram.undoManager.add(
                new CompoundUndoableAction([
                  new AddStylesheetUndoableAction(uow.diagram, s),
                  new SnapshotUndoableAction('Delete style', uow.diagram, snapshots)
                ])
              );
            }}
          />
          <ModifyStyleDialog
            isOpen={modifyDialog !== undefined}
            onClose={() => setModifyDialog(undefined)}
            stylesheet={modifyDialog}
            onModify={e => {
              // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
              const uow = new UnitOfWork($d, true);
              const stylesheet = $d.document.styles.get(modifyDialog!.id);
              if (stylesheet) {
                stylesheet.setProps(e.props, uow);
                commitWithUndo(uow, 'Modify style');
              } else {
                uow.abort();
              }
            }}
          />
          <RenameStyleDialog
            isOpen={renameDialog !== undefined}
            onClose={() => setRenameDialog(undefined)}
            stylesheet={renameDialog}
            onRename={v => {
              const uow = new UnitOfWork($d, true);
              const stylesheet = $d.document.styles.get(renameDialog!.id)!;
              stylesheet.setName(v, uow);
              commitWithUndo(uow, 'Rename style');
            }}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
