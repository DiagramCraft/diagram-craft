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
import styles from './RuleEditorDialog.module.css';
import React from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { StyleSheetAction } from './StyleSheetAction';
import { StyleAction } from './StyleAction';
import { HideAction } from './HideAction';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { ClauseList } from './ClauseList';

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
