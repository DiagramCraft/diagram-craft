import { useEffect, useMemo, useState } from 'react';
import { bonsai } from 'bonsai-js';
import { arrays, math } from 'bonsai-js/stdlib';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';

export type ExpressionTestField = {
  id: string;
  label?: string;
  type: string;
  resultType?: string;
};

export type ExpressionTestRoot = 'entity' | 'assessment';

type Props = {
  open: boolean;
  field: ExpressionTestField;
  expression: string;
  root?: ExpressionTestRoot;
  onClose: () => void;
  onSave: (expression: string) => void;
};

const engine = bonsai<{
  entity?: Record<string, unknown>;
  assessment?: Record<string, unknown>;
}>({ timeout: 50, maxDepth: 50 })
  .use(arrays)
  .use(math);

const formatValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const DerivedExpressionTestDialog = ({
  open,
  field,
  expression: initialExpression,
  root = 'entity',
  onClose,
  onSave
}: Props) => {
  const [expression, setExpression] = useState(initialExpression);
  const [rootJson, setRootJson] = useState('{}');

  useEffect(() => {
    if (open) {
      setExpression(initialExpression);
      setRootJson('{}');
    }
  }, [initialExpression, open]);

  const result = useMemo(() => {
    if (!open) return null;
    const validation = engine.validate(expression);
    if (!validation.valid) {
      return {
        error: validation.errors.map(error => error.formatted ?? error.message).join('; ')
      };
    }
    try {
      const rootValue = JSON.parse(rootJson);
      if (rootValue == null || typeof rootValue !== 'object' || Array.isArray(rootValue)) {
        throw new Error(`${root} JSON must be an object`);
      }
      const compiled = engine.compile(expression);
      return { value: compiled.evaluateSync({ [root]: rootValue }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [expression, open, root, rootJson]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Test expression: ${field.label || field.id}`}
      width={700}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        { label: 'Apply expression', type: 'default', onClick: () => onSave(expression) }
      ]}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
            Expression
          </div>
          <TextArea
            value={expression}
            onChange={value => setExpression(value ?? '')}
            rows={3}
            placeholder="entity.amount * 1.25"
          />
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
            {root === 'entity' ? 'Entity' : 'Assessment'} JSON
          </div>
          <TextArea
            value={rootJson}
            onChange={value => setRootJson(value ?? '{}')}
            rows={10}
            placeholder={
              '{"metadata":{"name":"Analytics Platform"},"dataFlowsIn":[{"protocol":"Kafka","entity":{"metadata":{"name":"Customer Portal"}}}]}'
            }
          />
          <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            {root === 'entity'
              ? "The JSON has the current entity's fields at the top level, plus metadata and direct relation targets."
              : "The JSON has the assessment's response fields at the top level."}
          </div>
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
            Output
          </div>
          <pre
            style={{
              margin: 0,
              padding: 10,
              minHeight: 38,
              whiteSpace: 'pre-wrap',
              color: result?.error ? 'var(--error-color, #d44)' : undefined,
              background: 'var(--cmp-bg)'
            }}
          >
            {result?.error ?? formatValue(result?.value)}
          </pre>
        </div>
      </div>
    </Dialog>
  );
};
