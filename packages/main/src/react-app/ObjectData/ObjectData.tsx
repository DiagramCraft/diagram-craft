import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { Select } from '../components/Select.tsx';
import { useDiagram } from '../context/DiagramContext.ts';
import { useElementProperty } from '../ObjectProperties/useProperty.ts';
import React, { ChangeEvent, useCallback, useState } from 'react';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo, SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';
import { unique } from '../../utils/array.ts';
import { useRedraw } from '../useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbDots } from 'react-icons/tb';
import {
  AddSchemaUndoableAction,
  DataSchema,
  DeleteSchemaUndoableAction,
  ModifySchemaUndoableAction
} from '../../model/diagramDataSchemas.ts';
import { newid } from '../../utils/id.ts';
import { MessageDialog, MessageDialogState } from '../components/MessageDialog.tsx';
import { CompoundUndoableAction } from '../../model/undoManager.ts';
import { JSONDialog } from '../components/JSONDialog.tsx';

const makeTemplate = (): DataSchema => {
  return {
    id: newid(),
    name: 'New schema',
    fields: [
      {
        id: 'field1',
        name: 'Field 1',
        type: 'text'
      },
      {
        id: 'field2',
        name: 'Field 2',
        type: 'longtext'
      }
    ]
  };
};

export const ObjectData = () => {
  const $d = useDiagram();
  const redraw = useRedraw();

  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<MessageDialogState>(
    MessageDialog.INITIAL_STATE
  );

  const [modifyDialog, setModifyDialog] = useState<DataSchema | undefined>(undefined);

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);

  const schema = useElementProperty($d, 'data.schema', 'none');

  const changeCallback = useCallback(
    (id: string, ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const uow = new UnitOfWork($d, true);
      $d.selectionState.elements.forEach(e => {
        e.updateProps(p => {
          p.data ??= {};
          p.data.data ??= {};
          p.data.data[id] = (ev.target! as HTMLInputElement).value;
        }, uow);
      });
      commitWithUndo(uow, 'Update data');
    },
    [$d]
  );

  if ($d.selectionState.elements.length === 0)
    return (
      <Accordion.Root className="cmp-accordion" type="single" defaultValue={'data'}>
        <Accordion.Item className="cmp-accordion__item" value="data">
          <AccordionTrigger>Data</AccordionTrigger>
          <AccordionContent>&nbsp;</AccordionContent>
        </Accordion.Item>
      </Accordion.Root>
    );

  return (
    <>
      <Accordion.Root className="cmp-accordion" type="single" defaultValue={'data'}>
        <Accordion.Item className="cmp-accordion__item" value="data">
          <AccordionTrigger>Data</AccordionTrigger>
          <AccordionContent>
            {/*<div className={'cmp-labeled-table'}>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Type:</div>
            <div className={'cmp-labeled-table__value'}>
              Derived (overrides) | Standalone (schema)
            </div>
          </div>*/}
            <div className={'cmp-labeled-table'}>
              <div className={'cmp-labeled-table__label util-a-top-center'}>Schema:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <Select
                  value={schema.val}
                  values={[
                    {
                      value: 'none',
                      label: 'None'
                    },
                    ...$d.document.schemas.all.map(s => ({
                      value: s.id,
                      label: s.name
                    }))
                  ]}
                  hasMultipleValues={schema.hasMultipleValues}
                  onValueChange={v => {
                    schema.set(v);
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
                          if (schema.val === 'none') return;
                          setModifyDialog($d.document.schemas.get(schema.val));
                        }}
                      >
                        Modify
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="cmp-context-menu__item"
                        onSelect={() => {
                          setConfirmDeleteDialog({
                            isOpen: true,
                            title: 'Confirm delete',
                            message: 'Are you sure you want to delete this schema?',
                            buttons: [
                              {
                                label: 'Yes',
                                type: 'danger',
                                onClick: () => {
                                  const uow = new UnitOfWork($d, true);
                                  const schemas = $d.document.schemas;
                                  const s = schemas.get(schema.val);
                                  schemas.removeSchema(s, uow);

                                  const snapshots = uow.commit();
                                  $d.undoManager.add(
                                    new CompoundUndoableAction([
                                      new DeleteSchemaUndoableAction(uow.diagram, s),
                                      new SnapshotUndoableAction(
                                        'Delete schema',
                                        uow.diagram,
                                        snapshots
                                      )
                                    ])
                                  );
                                  redraw();
                                }
                              },
                              { label: 'No', type: 'cancel', onClick: () => {} }
                            ]
                          });
                        }}
                      >
                        Delete
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="cmp-context-menu__separator" />
                      <DropdownMenu.Item
                        className="cmp-context-menu__item"
                        onSelect={() => {
                          setModifyDialog(makeTemplate());
                        }}
                      >
                        Add new
                      </DropdownMenu.Item>
                      <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
              {$d.document.schemas.get(schema.val).fields.map(f => {
                const v = unique(
                  $d.selectionState.elements.map(e => {
                    return e.props.data?.data?.[f.id];
                  })
                );

                return (
                  <React.Fragment key={f.id}>
                    <div className={'cmp-labeled-table__label util-a-top-center'}>{f.name}:</div>
                    <div className={'cmp-labeled-table__value cmp-text-input'}>
                      {f.type === 'text' && (
                        <input
                          type={'text'}
                          value={v.length > 1 ? '***' : v[0] ?? ''}
                          onChange={e => changeCallback(f.id, e)}
                        />
                      )}
                      {f.type === 'longtext' && (
                        <textarea
                          style={{ height: '40px' }}
                          value={v.length > 1 ? '***' : v[0] ?? ''}
                          onChange={e => changeCallback(f.id, e)}
                        />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </AccordionContent>
        </Accordion.Item>
      </Accordion.Root>

      <MessageDialog
        {...confirmDeleteDialog}
        onClose={() => setConfirmDeleteDialog(MessageDialog.INITIAL_STATE)}
      />

      <JSONDialog<DataSchema>
        title={'Modify schema'}
        label={'Schema'}
        isOpen={modifyDialog !== undefined}
        onClose={() => {
          setModifyDialog(undefined);
        }}
        data={modifyDialog}
        onModify={s => {
          const schemas = $d.document.schemas;
          const isNew = schemas.get(s.id).id === '';
          if (isNew) {
            $d.undoManager.addAndExecute(new AddSchemaUndoableAction($d, s));
          } else {
            $d.undoManager.addAndExecute(new ModifySchemaUndoableAction($d, s));
          }
          redraw();
        }}
      />
    </>
  );
};
