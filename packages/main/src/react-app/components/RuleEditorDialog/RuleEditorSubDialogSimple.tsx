import { deepClone } from '@diagram-craft/utils/object';
import type {
  EditableAdjustmentRuleAction,
  EditableElementSearchClause,
  SubRuleEditorDialogRef
} from './RuleEditorDialog';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type {
  AdjustmentRule,
  AdjustmentRuleAction
} from '@diagram-craft/model/diagramLayerRuleTypes';
import { EDGE_EDITORS, type EditorTypes, NODE_EDITORS } from './editors';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import type { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';
import { normalizeRuleActions } from './common';
import { newid } from '@diagram-craft/utils/id';
import styles from './RuleEditorSubDialogSimple.module.css';
import React from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { StyleSheetAction } from './StyleSheetAction';
import { StyleAction } from './StyleAction';
import { HideAction } from './HideAction';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { useDiagram } from '../../../application';
import {
  jsonHighlighter,
  SyntaxHighlightingEditor
} from '@diagram-craft/app-components/SyntaxHighlightingEditor';
import { validProps } from '@diagram-craft/model/diagramLayerRule';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { TreeSelect } from '@diagram-craft/app-components/TreeSelect';

export const RuleEditorSubDialogSimple = forwardRef<
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
