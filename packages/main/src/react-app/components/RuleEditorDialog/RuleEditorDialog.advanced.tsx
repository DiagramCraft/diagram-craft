import { forwardRef, useImperativeHandle, useState } from 'react';
import type { SubRuleEditorDialogRef } from './RuleEditorDialog';
import type { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import type { EditorTypes } from './editors';
import { useDiagram } from '../../../application';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { queryInput } from '@diagram-craft/model/diagramLayerRule';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';
import styles from './RuleEditorDialog.module.css';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import {
  jsonHighlighter,
  SyntaxHighlightingEditor
} from '@diagram-craft/app-components/SyntaxHighlightingEditor';
import { parseAndQuery } from 'embeddable-jq';

export const RuleEditorSubDialogAdvanced = forwardRef<
  SubRuleEditorDialogRef,
  {
    ref: React.Ref<SubRuleEditorDialogRef>;
    rule: AdjustmentRule & { type: 'advanced' };
    type: EditorTypes;
  }
>((props, ref) => {
  const diagram = useDiagram();
  const [rule, setRule] = useState(props.rule.rule);
  const [triggers, setTriggers] = useState(props.rule.triggers ?? []);
  const [debug, setDebug] = useState(props.rule.debug ?? false);
  const [result, setResult] = useState('');

  useImperativeHandle(ref, () => ({
    apply: (dest: AdjustmentRule) => {
      if (dest.type !== 'advanced') throw new VerifyNotReached();
      dest.rule = rule;
      dest.triggers = triggers;
      dest.debug = debug;
    }
  }));

  const run = () => {
    const r = parseAndQuery(rule, [queryInput(diagram)]);
    setResult(JSON.stringify(r, null, 2));
  };

  const addTrigger = () => {
    setTriggers([...triggers, { type: 'interval', interval: 60 }]);
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const updateTrigger = (
    index: number,
    updatedTrigger:
      | { type: 'interval'; interval: number }
      | { type: 'element'; elementType: 'edge' | 'node' }
      | { type: 'data'; schema: string }
  ) => {
    setTriggers(triggers.map((t, i) => (i === index ? updatedTrigger : t)));
  };

  return (
    <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
        <h4 className={styles.ruleEditor__sectionTitle} style={{ margin: 0 }}>
          Triggers
        </h4>
        <Button type={'icon-only'} onClick={addTrigger} style={{ marginLeft: 'auto' }}>
          <TbPlus /> Add
        </Button>
      </div>
      {triggers.length === 0 && (
        <div style={{ color: 'var(--base-fg-dim)' }}>No triggers defined</div>
      )}
      {triggers.map((trigger, idx) => (
        <div key={idx} className={styles.ruleEditor__clause}>
          <div className={styles.ruleEditorClause__select}>
            <Select.Root
              value={trigger.type}
              onChange={type => {
                if (type === 'interval') {
                  updateTrigger(idx, { type: 'interval', interval: 15 });
                } else if (type === 'element') {
                  updateTrigger(idx, { type: 'element', elementType: 'node' });
                } else if (type === 'data') {
                  updateTrigger(idx, { type: 'data', schema: '' });
                }
              }}
            >
              <Select.Item value={'interval'}>Interval</Select.Item>
              <Select.Item value={'element'}>Element</Select.Item>
              <Select.Item value={'data'}>Data</Select.Item>
            </Select.Root>
          </div>

          <div className={styles.ruleEditorClause__props}>
            {trigger.type === 'interval' && (
              <div className={styles.ruleEditorClause__propsRow}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <TextInput
                    type="number"
                    value={trigger.interval.toString()}
                    onChange={v => {
                      const interval = parseInt(v ?? '', 10);
                      if (!Number.isNaN(interval)) {
                        updateTrigger(idx, { type: 'interval', interval });
                      }
                    }}
                  />
                  <span>&nbsp;s</span>
                </div>
              </div>
            )}
            {trigger.type === 'element' && (
              <div className={styles.ruleEditorClause__propsRow}>
                <Select.Root
                  value={trigger.elementType}
                  onChange={elementType => {
                    updateTrigger(idx, {
                      type: 'element',
                      elementType: elementType as 'edge' | 'node'
                    });
                  }}
                >
                  <Select.Item value={'node'}>Node</Select.Item>
                  <Select.Item value={'edge'}>Edge</Select.Item>
                </Select.Root>
              </div>
            )}
            {trigger.type === 'data' && (
              <div className={styles.ruleEditorClause__propsRow}>
                <Select.Root
                  value={trigger.schema}
                  placeholder="Select schema"
                  onChange={schemaId => {
                    updateTrigger(idx, { type: 'data', schema: schemaId ?? '' });
                  }}
                >
                  {diagram.document.data.db.schemas.map(schema => (
                    <Select.Item key={schema.id} value={schema.id}>
                      {schema.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </div>
            )}
          </div>

          <div className={styles.ruleEditorClause__buttons}>
            <Button type={'icon-only'} onClick={() => removeTrigger(idx)}>
              <TbTrash />
            </Button>
          </div>
        </div>
      ))}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          marginTop: '0.25rem'
        }}
      >
        <div>
          Code:
          <SyntaxHighlightingEditor
            value={rule}
            rows={10}
            onChange={v => setRule(v ?? '')}
            highlighter={jsonHighlighter}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                run();
              }
            }}
          />
          <div
            style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
              Debug mode
            </label>
            <div style={{ marginLeft: 'auto' }}>
              <Button type={'secondary'} onClick={() => run()}>
                Run...
              </Button>
            </div>
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
