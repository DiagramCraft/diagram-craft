import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { validProps } from '@diagram-craft/model/diagramLayerRule';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbLine, TbPencilCode, TbPentagon, TbPlus, TbTrash } from 'react-icons/tb';
import { PropsEditor } from './PropsEditor';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { deepClone } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import {
  EDGE_EDITORS,
  type EdgeEditorRegistry,
  EditorTypes,
  NODE_EDITORS,
  type NodeEditorRegistry
} from './editors';
import { StyleAction } from './StyleAction';
import { TreeSelect } from '@diagram-craft/app-components/TreeSelect';
import { StyleSheetAction } from './StyleSheetAction';
import { AdjustmentRule, AdjustmentRuleAction } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';
import { HideAction } from './HideAction';
import { RuleEditorDialogProps } from '@diagram-craft/canvas-app/dialogs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { useDiagram } from '../../../application';
import styles from './RuleEditorDialog.module.css';
import { mustExist, NotImplementedYet, VerifyNotReached } from '@diagram-craft/utils/assert';
import { parseAndQuery } from 'embeddable-jq';
import { QueryDiagram } from '@diagram-craft/model/queryModel';
import {
  jsonHighlighter,
  SyntaxHighlightingEditor
} from '@diagram-craft/app-components/SyntaxHighlightingEditor';

export type EditableAdjustmentRuleAction = Partial<AdjustmentRuleAction> & { kind?: string };
export type EditableElementSearchClause = Partial<ElementSearchClause>;

const normalizeRuleActions = (
  rule: AdjustmentRule | undefined,
  registry: NodeEditorRegistry | EdgeEditorRegistry
): Array<EditableAdjustmentRuleAction> => {
  if (!rule) return [];
  if (rule.type === 'advanced') throw new NotImplementedYet();

  const dest: Array<EditableAdjustmentRuleAction> = [];
  for (const a of rule.actions) {
    if (a.type === 'set-props') {
      const propsEditor = new PropsEditor(registry, a.props);
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
          <div key={c.id} className={styles.ruleEditor__clause}>
            <div className={styles.ruleEditorClause__select}>
              <Select.Root
                value={c.type ?? ''}
                placeholder={'Select Rule'}
                onChange={t => {
                  const newClauses = [...props.clauses];
                  // @ts-expect-error
                  newClauses[idx].type = t;
                  props.onChange(newClauses);
                }}
              >
                <Select.Item value={'query'}>Query</Select.Item>
                <Select.Item value={'props'}>Property</Select.Item>
                <Select.Item value={'tags'}>Tags</Select.Item>
                <Select.Item value={'comment'}>Comment</Select.Item>
                {!props.subClauses && <Select.Item value={'any'}>Any</Select.Item>}
              </Select.Root>
            </div>

            <div className={styles.ruleEditorClause__props}>
              {c.type === 'query' && (
                <SyntaxHighlightingEditor
                  highlighter={jsonHighlighter}
                  rows={3}
                  className={styles.ruleEditorClause__queryTextArea}
                  defaultValue={c.query ?? ''}
                  onKeyDown={e => {
                    // TODO: Why is this needed?
                    e.stopPropagation();
                  }}
                  onChange={e => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].query = e.target.value;
                    props.onChange(newClauses);
                  }}
                />
              )}
              {c.type === 'any' && (
                <div className={styles.ruleEditorClause__anyContainer}>
                  <div className={styles.ruleEditorClause__anyLine}></div>
                </div>
              )}
              {c.type === 'props' && (
                <div className={styles.ruleEditorClause__propsRow}>
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
                      // @ts-expect-error
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
                <MultiSelect
                  selectedValues={c.tags || []}
                  availableItems={[...diagram.document.tags.tags].map(tag => ({
                    value: tag,
                    label: tag
                  }))}
                  onSelectionChange={newTags => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].tags = newTags;
                    props.onChange(newClauses);
                  }}
                  allowCustomValues={true}
                  placeholder="Select tags..."
                />
              )}
              {c.type === 'comment' && (
                <Select.Root
                  value={c.state ?? 'any'}
                  placeholder={'Any comment state'}
                  onChange={state => {
                    const newClauses = [...props.clauses];
                    // @ts-expect-error
                    newClauses[idx].state = state === 'any' ? undefined : state;
                    props.onChange(newClauses);
                  }}
                >
                  <Select.Item value={'any'}>Any</Select.Item>
                  <Select.Item value={'unresolved'}>Unresolved</Select.Item>
                  <Select.Item value={'resolved'}>Resolved</Select.Item>
                </Select.Root>
              )}
              {c.type !== 'query' &&
                c.type !== 'any' &&
                c.type !== 'props' &&
                c.type !== 'tags' &&
                c.type !== 'comment' && <div></div>}
            </div>

            <div className={styles.ruleEditorClause__buttons}>
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
            </div>

            {c.type === 'any' && (
              <div className={styles.ruleEditor__subClause}>
                <ClauseList
                  clauses={c.clauses ?? [{ id: newid() }]}
                  onChange={newClauses => {
                    c.clauses = newClauses as ElementSearchClause[];
                    // Note: the clone here is to force rerender
                    props.onChange([...props.clauses]);
                  }}
                  subClauses={true}
                  type={props.type}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

type ClauseListProps = {
  clauses: EditableElementSearchClause[];
  onChange: (newClauses: EditableElementSearchClause[]) => void;
  subClauses: boolean;
  type: 'edge' | 'node';
};

type SubRuleEditorDialogRef = {
  apply: (dest: AdjustmentRule) => void;
};

const AdvancedRuleEditorSubDialog = forwardRef<
  SubRuleEditorDialogRef,
  {
    ref: React.Ref<SubRuleEditorDialogRef>;
    rule: AdjustmentRule & { type: 'advanced' };
    type: EditorTypes;
  }
>((props, ref) => {
  const diagram = useDiagram();
  const [rule, setRule] = useState(props.rule.rule);
  const [result, setResult] = useState('');

  useImperativeHandle(ref, () => ({
    apply: (dest: AdjustmentRule) => {
      if (dest.type !== 'advanced') throw new VerifyNotReached();
      dest.rule = rule;
    }
  }));

  const run = () => {
    const r = parseAndQuery(rule, [new QueryDiagram(diagram)]);
    setResult(JSON.stringify(r, null, 2));
  };

  return (
    <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
      Triggers:
      <div>
        <Button type={'secondary'} onClick={() => console.log('to be implemented')}>
          <TbPlus /> Add
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem'
        }}
      >
        <div>
          Code:
          <SyntaxHighlightingEditor
            value={rule}
            rows={10}
            onChange={v => setRule(v ?? '')}
            highlighter={jsonHighlighter}
          />
          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type={'secondary'} onClick={() => run()}>
              Run...
            </Button>
          </div>
        </div>
        <div>
          Result:
          <SyntaxHighlightingEditor value={result} rows={10} highlighter={jsonHighlighter} />
        </div>
      </div>
    </div>
  );
});

const SimpleRuleEditorSubDialog = forwardRef<
  SubRuleEditorDialogRef,
  {
    ref: React.Ref<SubRuleEditorDialogRef>;
    rule: AdjustmentRule & ({ type: 'edge' } | { type: 'node' });
    type: EditorTypes;
  }
>((props, ref) => {
  const [actions, setActions] = useState<EditableAdjustmentRuleAction[]>(
    normalizeRuleActions(deepClone(props.rule), props.type === 'node' ? NODE_EDITORS : EDGE_EDITORS)
  );
  const [clauses, setClauses] = useState<EditableElementSearchClause[]>(
    deepClone(props.rule)?.clauses ?? []
  );

  useImperativeHandle(ref, () => ({
    apply: (dest: AdjustmentRule) => {
      if (dest.type === 'advanced') throw new VerifyNotReached();
      console.log('APPLY');
      dest.clauses = clauses
        // TODO: Additional validations
        .filter(c => c.type !== undefined)
        .map(c => c as ElementSearchClause);
      dest.actions = actions
        // TODO: Additional validations
        .filter(a => a.type !== undefined)
        .map(a => a as AdjustmentRuleAction);
    }
  }));

  useEffect(() => {
    setActions(
      normalizeRuleActions(
        deepClone(props.rule),
        props.type === 'node' ? NODE_EDITORS : EDGE_EDITORS
      )
    );
    setClauses(deepClone(props.rule)?.clauses ?? []);
  }, [props.rule, props.type]);

  const changeAction = (
    existing: EditableAdjustmentRuleAction,
    newAction: EditableAdjustmentRuleAction
  ) => {
    setActions(actions.map(a => (a === existing ? newAction : a)));
  };

  const editors = props.type === 'node' ? NODE_EDITORS : EDGE_EDITORS;

  const isValidaAction = (action: EditableAdjustmentRuleAction) =>
    action.type !== 'set-props' || action.kind === undefined || (action.kind ?? '') in editors;
  const filteredActions = actions.filter(isValidaAction);
  if (filteredActions.length === 0) {
    const newAction = { id: newid() };
    actions.push(newAction);
    setActions(actions);
  }

  if (props.type === 'advanced') return null;

  return (
    <div>
      <h4 className={styles.ruleEditor__sectionTitle}>If</h4>
      <div></div>
      <div></div>
      <div></div>

      <div className={styles.ruleEditor__clauseList}>
        <ClauseList clauses={clauses} onChange={setClauses} subClauses={false} type={props.type} />
      </div>

      <div className={styles.ruleEditor__actionSection}>
        <h4 className={styles.ruleEditor__sectionTitle}>Then</h4>
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
                  // @ts-expect-error
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
                  type={props.type}
                  onChange={a => changeAction(action, a)}
                />
              )}

              {action.type === 'set-stylesheet' && (
                <StyleSheetAction
                  action={action}
                  type={props.type}
                  onChange={a => changeAction(action, a)}
                />
              )}

              {action.type === 'hide' && (
                <HideAction
                  action={action}
                  type={props.type}
                  onChange={a => changeAction(action, a)}
                />
              )}

              {action.type !== 'set-props' &&
                action.type !== 'set-stylesheet' &&
                action.type !== 'hide' && <div></div>}

              <div>
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
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

export const RuleEditorDialog = (props: Props) => {
  const [type, setType] = useState<EditorTypes>(props.rule?.type ?? 'node');
  const [rule] = useState(deepClone(props.rule));

  const simpleRef = useRef<SubRuleEditorDialogRef>(null);
  const advancedRef = useRef<SubRuleEditorDialogRef>(null);

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => ref.current?.focus(), 100);
  }, [props.open]);

  if (!props.rule || !rule) return null;

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
            rule.name = ref.current!.value;
            rule.type = type;

            if (rule.type === 'node' || rule.type === 'edge') {
              mustExist(simpleRef.current).apply(rule);
            } else {
              mustExist(advancedRef.current).apply(rule);
            }

            props.onOk(rule);
          },
          label: 'Save'
        }
      ]}
      title={'Rule Editor'}
    >
      <div className={styles.ruleEditor__container}>
        <div>
          <label>{'Name'}:</label>
          <TextInput ref={ref} value={rule.name} size={40} />
        </div>
        <div>
          <label>{'Type'}:</label>
          <div>
            <ToggleButtonGroup.Root
              type={'single'}
              value={type}
              onChange={value => {
                // biome-ignore lint/suspicious/noExplicitAny: false positive
                setType(value as any);
              }}
            >
              <ToggleButtonGroup.Item value={'node'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbPentagon /> Node
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'edge'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbLine /> Edge
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'advanced'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbPencilCode /> Advanced
                </div>
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        </div>
      </div>
      {type === 'node' && (
        <SimpleRuleEditorSubDialog
          ref={simpleRef}
          rule={rule as AdjustmentRule & { type: 'node' }}
          type={type}
        />
      )}
      {type === 'edge' && (
        <SimpleRuleEditorSubDialog
          ref={simpleRef}
          rule={rule as AdjustmentRule & { type: 'edge' }}
          type={type}
        />
      )}
      {type === 'advanced' && (
        <AdvancedRuleEditorSubDialog
          ref={advancedRef}
          rule={rule as AdjustmentRule & { type: 'advanced' }}
          type={type}
        />
      )}
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (rule: AdjustmentRule) => void;
  onCancel?: () => void;
} & RuleEditorDialogProps;
