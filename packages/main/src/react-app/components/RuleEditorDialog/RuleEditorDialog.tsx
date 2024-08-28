import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import {
  AdjustmentRule,
  AdjustmentRuleAction,
  AdjustmentRuleClause
} from '@diagram-craft/model/diagramLayerRule';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbLine, TbPentagon, TbPlus, TbTrash } from 'react-icons/tb';
import { PropsEditor } from '@diagram-craft/canvas-app/PropsEditor';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { deepClone } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { Editor, EDITORS, EditorTypes } from './editors';
import { StyleAction } from './StyleAction';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      ruleEditor: {
        props: {
          rule: AdjustmentRule;
        };
        callback: AdjustmentRule;
      };
    }
  }
}

export type EditableAdjustmentRuleAction = Partial<AdjustmentRuleAction> & { kind?: string };
export type EditableAdjustmentRuleClause = Partial<AdjustmentRuleClause>;

const normalizeRuleActions = (
  rule: AdjustmentRule | undefined
): Array<EditableAdjustmentRuleAction> => {
  if (!rule) return [];

  const dest: Array<EditableAdjustmentRuleAction> = [];
  for (const a of rule.actions) {
    if (a.type === 'set-props') {
      const propsEditor = new PropsEditor<Editor, EditorTypes>(EDITORS, a.props);
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

export const RuleEditorDialog = (props: Props) => {
  const [rule, setRule] = useState(deepClone(props.rule));
  const [actions, setActions] = useState<EditableAdjustmentRuleAction[]>(
    normalizeRuleActions(deepClone(props.rule))
  );
  const [clauses, setClauses] = useState<EditableAdjustmentRuleClause[]>(
    deepClone(props.rule)?.clauses ?? []
  );

  useEffect(() => {
    setActions(normalizeRuleActions(deepClone(props.rule)));
    setRule(deepClone(props.rule));
    setClauses(deepClone(props.rule)?.clauses ?? []);
  }, [props.rule, props.open]);

  const [type, setType] = useState<EditorTypes>('node');

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
    console.log(newAction);
    setActions(actions.map(a => (a === existing ? newAction : a)));
  };

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
            rule!.clauses = clauses
              // TODO: Additional validations
              .filter(c => c.type !== undefined)
              .map(c => c as AdjustmentRuleClause);
            rule!.actions = actions
              // TODO: Additional validations
              .filter(a => a.type !== undefined)
              .map(a => a as AdjustmentRuleAction);
            //console.log(rule);

            props.onSave(rule);
          },
          label: 'Save'
        }
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
          <div className={'cmp-text-input'}>
            <input
              ref={ref}
              type={'text'}
              size={40}
              defaultValue={rule?.name ?? ''}
              onKeyDown={e => {
                // TODO: Why is this needed?
                e.stopPropagation();
              }}
            />
          </div>
        </div>
        <div>
          <label>{'Type'}:</label>
          <div>
            <ToggleButtonGroup.Root
              type={'multiple'}
              value={type === 'both' ? ['node', 'edge'] : [type]}
              onValueChange={value => {
                if (value.length === 0) return;
                if (value.length === 2) return setType('both');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setType(value[0] as any);
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

          {clauses.map((c, idx) => {
            return (
              <React.Fragment key={c.id}>
                <Select.Root
                  value={c.type ?? ''}
                  placeholder={'Select Rule Type'}
                  onValueChange={t => {
                    const newClauses = [...clauses];
                    // @ts-ignore
                    newClauses[idx].type = t;
                    setClauses(newClauses);
                  }}
                >
                  <Select.Item value={'query'}>Query</Select.Item>
                </Select.Root>
                {c.type === 'query' && (
                  <>
                    <div className={'cmp-text-input'}>
                      <textarea
                        style={{ height: '3rem', resize: 'vertical' }}
                        defaultValue={c.query ?? ''}
                        onKeyDown={e => {
                          // TODO: Why is this needed?
                          e.stopPropagation();
                        }}
                        onChange={e => {
                          console.log(e.target.value);
                          const newClauses = [...clauses];
                          // @ts-ignore
                          newClauses[idx].query = e.target.value;
                          setClauses(newClauses);
                        }}
                      />
                    </div>
                  </>
                )}
                {c.type !== 'query' && <div></div>}

                <Button
                  type={'icon-only'}
                  onClick={() => {
                    const newClauses = clauses.toSpliced(idx + 1, 0, {
                      id: newid()
                    });
                    setClauses(newClauses);
                  }}
                >
                  <TbPlus />
                </Button>
                <Button
                  type={'icon-only'}
                  disabled={idx === 0 && clauses.length === 1}
                  onClick={() => {
                    const newClauses = clauses.toSpliced(idx, 1);
                    setClauses(newClauses);
                  }}
                >
                  <TbTrash />
                </Button>
              </React.Fragment>
            );
          })}

          <h4 style={{ margin: '0.5rem 0 0 0' }}>Then</h4>
          <div></div>
          <div></div>
          <div></div>

          {actions.map((action, idx) => {
            return (
              <React.Fragment key={action.id}>
                <Select.Root
                  value={action.type ?? ''}
                  placeholder={'Select action'}
                  onValueChange={s => {
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
                {action.type !== 'set-props' && <div></div>}

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
  onSave: (rule: AdjustmentRule) => void;
  onCancel: (() => void) | undefined;
  rule?: AdjustmentRule;
};
