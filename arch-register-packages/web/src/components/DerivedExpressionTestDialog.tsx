import { useEffect, useMemo, useState } from 'react';
import { bonsai } from 'bonsai-js';
import { arrays, math } from 'bonsai-js/stdlib';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Table } from './table/Table';

export type ExpressionTestField = {
  id: string;
  label?: string;
  type: string;
  resultType?: string;
};

type Props = {
  open: boolean;
  field: ExpressionTestField;
  fields: ExpressionTestField[];
  expression: string;
  onClose: () => void;
  onSave: (expression: string) => void;
};

type EvaluationContext = {
  values: Record<string, unknown>;
  entity: { id: string; schemaId: string; values: Record<string, unknown> };
  dependents: Array<{ id: string; schemaId: string; values: Record<string, unknown> }>;
};

const engine = bonsai<EvaluationContext>({ timeout: 50, maxDepth: 50 })
  .use(arrays)
  .use(math)
  .addContextFunction('field', (context, fieldId) => context.values[String(fieldId)]);

const parseValue = (field: ExpressionTestField, value: string): unknown => {
  if (value.trim() === '') return undefined;
  const valueType = field.type === 'derived' ? field.resultType : field.type;
  if (valueType === 'number' || valueType === 'rating') return Number(value);
  if (valueType === 'boolean') return value.trim().toLowerCase() === 'true';
  if (valueType === 'currency') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const formatValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 'Empty';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export const DerivedExpressionTestDialog = ({
  open,
  field,
  fields,
  expression: initialExpression,
  onClose,
  onSave
}: Props) => {
  const [expression, setExpression] = useState(initialExpression);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dependentsJson, setDependentsJson] = useState('[]');

  useEffect(() => {
    if (open) {
      setExpression(initialExpression);
      setValues({});
      setDependentsJson('[]');
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
      const compiled = engine.compile(expression);
      const dependents = JSON.parse(dependentsJson);
      if (!Array.isArray(dependents)) throw new Error('Direct dependents must be a JSON array');
      const inputValues = Object.fromEntries(
        fields
          .filter(item => item.id !== field.id)
          .map(item => [item.id, parseValue(item, values[item.id] ?? '')])
      );
      return {
        value: compiled.evaluateSync({
          values: inputValues,
          entity: { id: 'test-entity', schemaId: 'current', values: inputValues },
          dependents
        })
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [dependentsJson, expression, field.id, fields, open, values]);

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
            Direct dependents (JSON)
          </div>
          <TextArea
            value={dependentsJson}
            onChange={value => setDependentsJson(value ?? '[]')}
            rows={4}
            placeholder={
              '[{"schemaId":"contract","values":{"annual_cost":{"amount":1200,"currency":"USD"}}}]'
            }
          />
          <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            Use <code>entity</code> and <code>dependents</code> for one-hop graph expressions. For
            example: <code>dependents.map(.values[&apos;annual_cost&apos;].amount) |&gt; sum</code>.
          </div>
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>
            Expression
          </div>
          <TextArea
            value={expression}
            onChange={value => setExpression(value ?? '')}
            rows={3}
            placeholder='field("input_field") + 1'
          />
        </div>
        <div>
          <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>
            Input values
          </div>
          <Table.Root bordered={false} layout="fixed">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>Label</Table.HeaderCell>
                <Table.HeaderCell>Value</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {fields
                .filter(item => item.id !== field.id)
                .map(item => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <code style={{ fontSize: 11 }}>{item.id}</code>
                    </Table.Cell>
                    <Table.Cell>{item.label || item.id}</Table.Cell>
                    <Table.Cell>
                      <TextInput
                        value={values[item.id] ?? ''}
                        onChange={value =>
                          setValues(current => ({ ...current, [item.id]: value ?? '' }))
                        }
                        placeholder={
                          item.type === 'boolean' ||
                          (item.type === 'derived' && item.resultType === 'boolean')
                            ? 'true or false'
                            : (item.resultType ?? item.type)
                        }
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              {fields.length === 1 && (
                <Table.EmptyRow colSpan={3} title="This expression has no other fields to input." />
              )}
            </Table.Body>
          </Table.Root>
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
