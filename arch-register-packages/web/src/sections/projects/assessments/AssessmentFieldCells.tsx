import { useState } from 'react';
import { TbStarFilled } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { getAssessmentEnumOptions } from '@arch-register/api-types/assessmentFieldOptions';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './AssessmentFieldCells.module.css';

type CellProps = {
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean | null) => void;
  disabled?: boolean;
};

export const RatingCell = ({
  value,
  onChange,
  disabled,
  max = 5
}: CellProps & { max?: number }) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const current = Number.isNaN(numericValue) ? 0 : numericValue;

  // Hover highlighting is pure CSS (stars rendered high-to-low, then flipped back to
  // left-to-right with flex-direction: row-reverse) rather than JS onMouseEnter/onMouseLeave
  // state — the browser's :hover pseudo-class can't miss a leave event the way fast pointer
  // movement across adjacent rows could desync manually tracked hover state.
  return (
    <div className={styles.stars}>
      {Array.from({ length: max }, (_, i) => max - i).map(n => (
        <button
          key={n}
          type="button"
          className={`${styles.star} ${n <= current ? styles.on : ''}`}
          disabled={disabled}
          onClick={() => onChange(n === current ? null : n)}
        >
          <TbStarFilled size={14} />
        </button>
      ))}
    </div>
  );
};

export const EnumCell = ({
  field,
  value,
  onChange,
  disabled
}: CellProps & { field: AssessmentField }) => {
  const { enums } = useWorkspaceContext();
  const options = getAssessmentEnumOptions(field, enums);

  return (
    <Select.Root
      value={typeof value === 'string' ? value : undefined}
      placeholder="—"
      disabled={disabled}
      onChange={v => onChange(v ?? null)}
    >
      {options.map(option => (
        <Select.Item key={option.value} value={option.value}>
          {option.label}
        </Select.Item>
      ))}
    </Select.Root>
  );
};

export const TextCell = ({ value, onChange, disabled }: CellProps) => {
  const [draft, setDraft] = useState(typeof value === 'string' ? value : (value?.toString() ?? ''));

  const commit = () => onChange(draft.trim() === '' ? null : draft.trim());

  return (
    <TextInput
      value={draft}
      disabled={disabled}
      onChange={v => setDraft(v ?? '')}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{ width: '100%' }}
    />
  );
};

export const AssessmentFieldCell = ({
  field,
  value,
  onChange,
  disabled
}: {
  field: AssessmentField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean | null) => void;
  disabled?: boolean;
}) => {
  const { enums } = useWorkspaceContext();
  if (field.type === 'rating')
    return (
      <RatingCell value={value} onChange={onChange} disabled={disabled} max={field.max ?? 5} />
    );
  if (field.type === 'enum')
    return <EnumCell field={field} value={value} onChange={onChange} disabled={disabled} />;
  if (field.type === 'derived') {
    if (field.resultType === 'select') {
      const options = getAssessmentEnumOptions(field, enums);
      const label = options.find(option => option.value === String(value ?? ''))?.label;
      return <span>{label ?? (value == null || value === '' ? '—' : String(value))}</span>;
    }
    return <span>{value == null || value === '' ? '—' : String(value)}</span>;
  }
  return <TextCell value={value} onChange={onChange} disabled={disabled} />;
};
