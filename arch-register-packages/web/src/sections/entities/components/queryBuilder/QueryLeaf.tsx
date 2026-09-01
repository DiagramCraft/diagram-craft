import { TbX } from 'react-icons/tb';
import type { QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { FilterRow, type FieldDef } from '../../../../components/FilterBuilder';
import { pathStepSummary } from './pathSummary';
import styles from './queryBuilder.module.css';

type LeafNode = Exclude<QueryNode, { kind: 'and' | 'or' | 'not' }>;

type QueryLeafProps = {
  node: LeafNode;
  fields: FieldDef[];
  onChange: (node: QueryNode) => void;
  onRemove: () => void;
};

/**
 * One terminal condition. A flat `predicate` (`path: []`) is the reused `FilterRow` from
 * `FilterBuilder`. Predicates that traverse relations, `relationExists`, and stray `freeText`
 * nodes render as a read-only summary for now - editing those visually lands with the traversal
 * phase (#2354, plan phase 5); until then they round-trip untouched and stay editable in Advanced
 * text mode.
 */
export const QueryLeaf = ({ node, fields, onChange, onRemove }: QueryLeafProps) => {
  if (node.kind === 'predicate' && node.path.length === 0) {
    const condition: FilterCondition = { fieldId: node.fieldId, op: node.op, value: node.value };
    return (
      <FilterRow
        condition={condition}
        fields={fields}
        onUpdate={updates => onChange({ ...node, ...updates })}
        onRemove={onRemove}
      />
    );
  }

  const summary =
    node.kind === 'freeText'
      ? `text contains "${node.value}"`
      : node.kind === 'relationExists'
        ? `${pathStepSummary(node.path)} exists`
        : `${pathStepSummary(node.path)} · ${node.fieldId} ${node.op}${
            node.op === 'empty' || node.op === 'not_empty' ? '' : ` ${formatValue(node.value)}`
          }`;

  return (
    <div className={styles.advancedLeaf}>
      <span className={styles.advancedLeafText} title={summary}>
        {summary}
      </span>
      <span className={styles.advancedLeafBadge}>text-only</span>
      <button type="button" className={styles.removeBtn} title="Remove" onClick={onRemove}>
        <TbX size={11} />
      </button>
    </div>
  );
};

const formatValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
