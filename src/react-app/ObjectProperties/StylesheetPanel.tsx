import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { Select } from '../components/Select.tsx';
import { TbDots } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useElementProperty } from './useProperty.ts';
import { newid } from '../../utils/id.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { SimpleDialog, SimpleDialogState } from '../components/SimpleDialog.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { getCommonProps, Stylesheet } from '../../model/diagramStyles.ts';
import { isNode } from '../../model/diagramElement.ts';

const NewStyleDialog = (props: NewStyleDialogProps) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.isOpen) {
      setTimeout(() => {
        ref.current?.focus();
      }, 100);
    }
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

type NewStyleDialogProps = Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
  onCreate: (v: string) => void;
};

const ModifyStyleDialog = (props: ModifyStyleDialogProps) => {
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
              console.log('error');
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
          defaultValue={props.stylesheet ? JSON.stringify(props.stylesheet, undefined, 2) : ''}
        />
      </div>
      {error && <div className={'cmp-text-input__error'}>Error: {error}</div>}
    </Dialog>
  );
};

type ModifyStyleDialogProps = Omit<
  ComponentProps<typeof Dialog>,
  'children' | 'title' | 'buttons'
> & {
  stylesheet: Stylesheet<ElementProps> | undefined;
  // eslint-disable-next-line
  onModify: (v: any) => void;
};

export const StylesheetPanel = (props: Props) => {
  const $d = useDiagram();

  const stylesheet = useElementProperty($d, 'style', 'default');

  const [confirmDeleteState, setConfirmDeleteState] = useState<SimpleDialogState>(
    SimpleDialog.INITIAL_STATE
  );
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [modifyProps, setModifyProps] = useState<Stylesheet<ElementProps> | undefined>(undefined);

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
                      $d.document.styles.setStylesheet(n, stylesheet.val, uow);
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
                    const style = $d.document.styles.nodeStyles.find(s => s.id === stylesheet.val);
                    if (style) {
                      style.props = getCommonProps(
                        $d.selectionState.elements.map(e => e.propsForEditing)
                      ) as NodeProps | EdgeProps;
                    }
                    $d.update();
                  }}
                >
                  Redefine from current
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setConfirmDeleteState({
                      isOpen: true,
                      title: 'Confirm delete',
                      message: 'Are you sure you want to delete this style?',
                      buttons: [
                        {
                          label: 'Yes',
                          type: 'danger',
                          onClick: () => {
                            // TODO: Need to implement this
                            const uow = new UnitOfWork($d, true);
                            $d.document.styles.deleteStylesheet(stylesheet.val, uow);
                            commitWithUndo(uow, 'Delete style');
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
                    setModifyProps($d.document.styles.get(stylesheet.val));
                  }}
                >
                  Modify
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    // TODO: Need to implement this
                  }}
                >
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />
                <DropdownMenu.Item
                  className="cmp-context-menu__item"
                  onSelect={() => {
                    setIsNewOpen(true);
                  }}
                >
                  Add new
                </DropdownMenu.Item>
                <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <SimpleDialog
            {...confirmDeleteState}
            onClose={() => setConfirmDeleteState(SimpleDialog.INITIAL_STATE)}
          />
          <NewStyleDialog
            isOpen={isNewOpen}
            onClose={() => setIsNewOpen(!isNewOpen)}
            onCreate={v => {
              const id = newid();
              $d.document.styles.nodeStyles.push({
                id: id,
                name: v,
                type: isNode($d.selectionState.elements[0]) ? 'node' : 'edge',
                props: getCommonProps($d.selectionState.elements.map(e => e.propsForEditing)) as
                  | NodeProps
                  | EdgeProps
              });

              const uow = new UnitOfWork($d, true);
              $d.document.styles.setStylesheet($d.selectionState.nodes[0], id, uow);
              commitWithUndo(uow, 'New style');
            }}
          />
          <ModifyStyleDialog
            isOpen={modifyProps !== undefined}
            onClose={() => setModifyProps(undefined)}
            stylesheet={modifyProps}
            onModify={e => {
              // TODO: Maybe to ask confirmation to apply to all selected nodes or copy
              if (e.type === 'node') {
                const nodeStylesheet = $d.document.styles.nodeStyles.find(
                  e => e.id === modifyProps!.id
                );
                if (nodeStylesheet) {
                  nodeStylesheet.props = e.props;
                }
              } else {
                const edgeStylesheet = $d.document.styles.edgeStyles.find(
                  e => e.id === modifyProps!.id
                );

                if (edgeStylesheet) {
                  edgeStylesheet.props = e.props;
                }
              }
              $d.update();
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
