import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { validProps } from '@diagram-craft/model/diagramLayerRule';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbLine, TbPentagon, TbPlus, TbTrash } from 'react-icons/tb';
import { EditorRegistry, PropsEditor } from '@diagram-craft/canvas-app/PropsEditor';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { deepClone } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { EDGE_EDITORS, Editor, EditorTypes, NODE_EDITORS } from './editors';
import { StyleAction } from './StyleAction';
import { TreeSelect } from '@diagram-craft/app-components/TreeSelect';
import { StyleSheetAction } from './StyleSheetAction';
import {
  AdjustmentRule,
  AdjustmentRuleAction,
  AdjustmentRuleClause
} from '@diagram-craft/model/diagramLayerRuleTypes';
import { HideAction } from './HideAction';
import { RuleEditorDialogProps } from '@diagram-craft/canvas-app/dialogs';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TagInput } from '@diagram-craft/app-components/TagInput';
import { useDiagram } from '../../../application';

export type EditableAdjustmentRuleAction = Partial<AdjustmentRuleAction> & { kind?: string };
export type EditableAdjustmentRuleClause = Partial<AdjustmentRuleClause>;

const normalizeRuleActions = (
  rule: AdjustmentRule | undefined,
  registry: EditorRegistry<Editor>
): Array<EditableAdjustmentRuleAction> => {
  if (!rule) return [];

  const dest: Array<EditableAdjustmentRuleAction> = [];
  for (const a of rule.actions) {
    if (a.type === 'set-props') {
      const propsEditor = new PropsEditor<Editor>(registry, a.props);
      for (const e of propsEditor.getEntries()) {
        dest.push({
          id: newid(),
          type: 'set-props',
          props: e.props,
          kind: e.kind
        });
      }
    } else {
      dest.push(a);
    }
  }

  return dest;
};

const ClauseList = (props: ClauseListProps) => {
  const diagram = useDiagram();

  return (
    <>
      {props.clauses.map((c, idx) => {
        return (
          <React.Fragment key={c.id}>
            <Select.Root
              value={c.type ?? ''}
              placeholder={'Select Rule'}
              style={props.indent ? { marginLeft: '1rem' } : {}}
              onChange={t => {
                const newClauses = [...props.clauses];
                // @ts-ignore
                newClauses[idx].type = t;
                props.onChange(newClauses);
              }}
            >
              <Select.Item value={'query'}>Query</Select.Item>
              <Select.Item value={'props'}>Property</Select.Item>
              <Select.Item value={'tags'}>Tags</Select.Item>
              {!props.indent && <Select.Item value={'any'}>Any</Select.Item>}
            </Select.Root>
            {c.type === 'query' && (
              <TextArea
                style={{ minHeight: '3rem', resize: 'vertical' }}
                value={c.query ?? ''}
                onKeyDown={e => {
                  // TODO: Why is this needed?
                  e.stopPropagation();
                }}
                onChange={e => {
                  const newClauses = [...props.clauses];
                  // @ts-ignore
                  newClauses[idx].query = e.target.value;
                  props.onChange(newClauses);
                }}
              />
            )}
            {c.type === 'any' && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div
                  style={{
                    width: '100%',
                    height: '1px',
                    borderTop: '1px solid var(--slate-4)'
                  }}
                ></div>
              </div>
            )}
            {c.type === 'props' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <TreeSelect.Root
                  value={c.path ?? ''}
                  onValueChange={v => {
                    c.path = v;
                    c.relation ??= 'eq';
                    props.onChange([...props.clauses]);
                  }}
                  items={validProps(props.type)}
                  placeholder={'Select property'}
                />
                {/* TODO: Filter relations based on type */}
                <Select.Root
                  value={'eq'}
                  onChange={cond => {
                    // @ts-ignore
                    c.relation = cond;
                    props.onChange([...props.clauses]);
                  }}
                >
                  <Select.Item value={'eq'}>Is</Select.Item>
                  <Select.Item value={'neq'}>Is Not</Select.Item>
                  <Select.Item value={'contains'}>Contains</Select.Item>
                  <Select.Item value={'matches'}>Matches</Select.Item>
                  <Select.Item value={'gt'}>Greater Than</Select.Item>
                  <Select.Item value={'lt'}>Less Than</Select.Item>
                </Select.Root>
                <TextInput
                  value={c.value ?? ''}
                  onChange={v => {
                    c.value = v;
                    c.relation ??= 'eq';
                    props.onChange([...props.clauses]);
                  }}
                />
              </div>
            )}
            {c.type === 'tags' && (
              <TagInput
                selectedTags={c.tags || []}
                availableTags={[...diagram.document.tags.tags]}
                onTagsChange={newTags => {
                  const newClauses = [...props.clauses];
                  // @ts-ignore
                  newClauses[idx].tags = newTags;
                  props.onChange(newClauses);
                }}
                placeholder="Select tags..."
              />
            )}
            {c.type !== 'query' && c.type !== 'any' && c.type !== 'props' && c.type !== 'tags' && (
              <div></div>
            )}

            <Button
              type={'icon-only'}
              onClick={() => {
                const newClauses = props.clauses.toSpliced(idx + 1, 0, {
                  id: newid()
                });
                props.onChange(newClauses);
              }}
            >
              <TbPlus />
            </Button>
            <Button
              type={'icon-only'}
              disabled={idx === 0 && props.clauses.length === 1}
              onClick={() => {
                const newClauses = props.clauses.toSpliced(idx, 1);
                props.onChange(newClauses);
              }}
            >
              <TbTrash />
            </Button>

            {c.type === 'any' && (
              <ClauseList
                clauses={c.clauses ?? [{ id: newid() }]}
                onChange={newClauses => {
                  c.clauses = newClauses as AdjustmentRuleClause[];
                  // Note: the clone here is to force rerender
                  props.onChange([...props.clauses]);
                }}
                indent={true}
                type={props.type}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

type ClauseListProps = {
  clauses: EditableAdjustmentRuleClause[];
  onChange: (newClauses: EditableAdjustmentRuleClause[]) => void;
  indent: boolean;
  type: 'edge' | 'node';
};

export const RuleEditorDialog = (props: Props) => {
  const [type, setType] = useState<EditorTypes>(props.rule?.type ?? 'node');
  const [rule, setRule] = useState(deepClone(props.rule));
  const [actions, setActions] = useState<EditableAdjustmentRuleAction[]>(
    normalizeRuleActions(deepClone(props.rule), type === 'node' ? NODE_EDITORS : EDGE_EDITORS)
  );
  const [clauses, setClauses] = useState<EditableAdjustmentRuleClause[]>(
    deepClone(props.rule)?.clauses ?? []
  );

  useEffect(() => {
    setActions(
      normalizeRuleActions(deepClone(props.rule), type === 'node' ? NODE_EDITORS : EDGE_EDITORS)
    );
    setRule(deepClone(props.rule));
    setClauses(deepClone(props.rule)?.clauses ?? []);
  }, [props.rule, props.open]);

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => ref.current?.focus(), 100);
  }, [props.open]);

  if (!props.rule || !rule) return null;

  const changeAction = (
    existing: EditableAdjustmentRuleAction,
    newAction: EditableAdjustmentRuleAction
  ) => {
    setActions(actions.map(a => (a === existing ? newAction : a)));
  };

  const editors = type === 'node' ? NODE_EDITORS : EDGE_EDITORS;

  const isValidaAction = (action: EditableAdjustmentRuleAction) =>
    action.type !== 'set-props' || action.kind === undefined || (action.kind ?? '') in editors;
  const filteredActions = actions.filter(isValidaAction);
  if (filteredActions.length === 0) {
    const newAction = { id: newid() };
    actions.push(newAction);
    setActions(actions);
  }

  return (
    <Dialog
      open={props.open}
      onClose={() => {}}
      buttons={[
        {
          type: 'cancel',
          onClick: () => {
            props.onCancel?.();
          },
          label: 'Cancel'
        },
        {
          type: 'default',
          onClick: () => {
            rule!.name = ref.current!.value;
            rule!.type = type;
            rule!.clauses = clauses
              // TODO: Additional validations
              .filter(c => c.type !== undefined)
              .map(c => c as AdjustmentRuleClause);
            rule!.actions = actions
              // TODO: Additional validations
              .filter(a => a.type !== undefined)
              .map(a => a as AdjustmentRuleAction);

            props.onOk(rule);
          },
          label: 'Save'
        }
        /*{
          type: 'secondary',
          onClick: () => {
            console.log(
              JSON.stringify(
                {
                  name: ref.current!.value,
                  type,
                  clauses,
                  actions
                },
                undefined,
                '  '
              )
            );
          },
          label: 'Dump'
        }*/
      ]}
      title={'Rule Editor'}
    >
      <div
        style={{
          display: 'grid',
          gap: '0.5rem',
          minWidth: '35rem',
          gridTemplateColumns: '1fr max-content'
        }}
      >
        <div>
          <label>{'Name'}:</label>
          <TextInput ref={ref} value={rule?.name ?? ''} size={40} />
        </div>
        <div>
          <label>{'Type'}:</label>
          <div>
            <ToggleButtonGroup.Root
              type={'single'}
              value={type}
              onChange={value => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setType(value as any);
              }}
            >
              <ToggleButtonGroup.Item value={'node'}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <TbPentagon /> Node
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'edge'}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <TbLine /> Edge
                </div>
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'grid',
            margin: '0.5rem -1rem 2rem -0.5rem',
            padding: '0 0.5rem 0 0.5rem',
            gap: '0.5rem',
            gridTemplateColumns: '8rem 8fr min-content min-content',
            gridAutoRows: 'min-content',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--tertiary-fg) var(--primary-bg)',
            maxHeight: '20rem',
            height: '20rem',
            overflowY: 'auto'
          }}
        >
          <h4 style={{ margin: '0.5rem 0 0 0' }}>If</h4>
          <div></div>
          <div></div>
          <div></div>

          <ClauseList clauses={clauses} onChange={setClauses} indent={false} type={type} />

          <h4 style={{ margin: '0.5rem 0 0 0' }}>Then</h4>
          <div></div>
          <div></div>
          <div></div>

          {actions.map((action, idx) => {
            return !isValidaAction(action) ? null : (
              <React.Fragment key={action.id}>
                <Select.Root
                  value={action.type ?? ''}
                  placeholder={'Select action'}
                  onChange={s => {
                    const newActions = [...actions];
                    // @ts-ignore
                    newActions[idx].type = s;
                    setActions(newActions);
                  }}
                >
                  <Select.Item value={'set-props'}>Set style</Select.Item>
                  <Select.Item value={'set-stylesheet'}>Set stylesheet</Select.Item>
                  <Select.Item value={'hide'}>Hide</Select.Item>
                </Select.Root>

                {action.type === 'set-props' && (
                  <StyleAction
                    action={action}
                    type={type}
                    onChange={a => changeAction(action, a)}
                  />
                )}

                {action.type === 'set-stylesheet' && (
                  <StyleSheetAction
                    action={action}
                    type={type}
                    onChange={a => changeAction(action, a)}
                  />
                )}

                {action.type === 'hide' && (
                  <HideAction action={action} type={type} onChange={a => changeAction(action, a)} />
                )}

                {action.type !== 'set-props' &&
                  action.type !== 'set-stylesheet' &&
                  action.type !== 'hide' && <div></div>}

                <Button
                  type={'icon-only'}
                  onClick={() => {
                    const newActions = actions.toSpliced(idx + 1, 0, {
                      id: newid()
                    });
                    setActions(newActions);
                  }}
                >
                  <TbPlus />
                </Button>
                <Button
                  type={'icon-only'}
                  disabled={idx === 0 && actions.length === 1}
                  onClick={() => {
                    const newActions = actions.toSpliced(idx, 1);
                    setActions(newActions);
                  }}
                >
                  <TbTrash />
                </Button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (rule: AdjustmentRule) => void;
  onCancel?: () => void;
} & RuleEditorDialogProps;
