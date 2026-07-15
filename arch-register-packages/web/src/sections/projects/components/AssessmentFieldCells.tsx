import { useState } from 'react';
import { TbStar, TbStarFilled } from 'react-icons/tb';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './AssessmentFieldCells.module.css';

type CellProps = {
  value: string | number | undefined;
  onChange: (value: string | number | null) => void;
  disabled?: boolean;
};

export const RatingCell = ({ value, onChange, disabled }: CellProps) => {
  const [hover, setHover] = useState<number | null>(null);
  const current = typeof value === 'number' ? value : Number(value) || 0;

  return (
    <div className={styles.stars} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = n <= (hover ?? current);
        return (
          <button
            key={n}
            type="button"
            className={styles.star}
            style={on ? { color: 'var(--warn, orange)' } : undefined}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n === current ? null : n)}
          >
            {on ? <TbStarFilled size={14} /> : <TbStar size={14} />}
          </button>
        );
      })}
    </div>
  );
};

export const EnumCell = ({
  field,
  value,
  onChange,
  disabled
}: CellProps & { field: Extract<AssessmentField, { type: 'enum' }> }) => {
  const { enums } = useWorkspaceContext();
  const enumDef = enums.find(e => e.id === field.enumId);
  const options = enumDef?.options ?? [];

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
  value: string | number | undefined;
  onChange: (value: string | number | null) => void;
  disabled?: boolean;
}) => {
  if (field.type === 'rating')
    return <RatingCell value={value} onChange={onChange} disabled={disabled} />;
  if (field.type === 'enum')
    return <EnumCell field={field} value={value} onChange={onChange} disabled={disabled} />;
  return <TextCell value={value} onChange={onChange} disabled={disabled} />;
};
