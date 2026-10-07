import { Select } from '@diagram-craft/app-components/Select';
import { durationUnits, type DurationUnit } from '@arch-register/api-types/common';
import { durationUnitLabel } from '../utils/durationFormat';

export type DurationInputValue = { amount?: number; unit?: DurationUnit };

/** Parses whatever is stored/edited for a duration field into a partially filled value. */
export const toDurationInputValue = (value: unknown): DurationInputValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as DurationInputValue)
    : {};

export const DurationInput = ({
  value,
  onChange,
  disabled,
  className
}: {
  value: unknown;
  onChange: (value: DurationInputValue) => void;
  disabled?: boolean;
  className?: string;
}) => {
  const duration = toDurationInputValue(value);
  const unit = duration.unit ?? 'years';
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        className={className}
        type="number"
        min={0}
        step="any"
        disabled={disabled}
        value={duration.amount ?? ''}
        onChange={event =>
          onChange({
            amount: event.target.value === '' ? undefined : Number(event.target.value),
            unit
          })
        }
        style={{ width: '100%' }}
      />
      <Select.Root
        value={unit}
        disabled={disabled}
        onChange={next =>
          onChange({ amount: duration.amount, unit: (next ?? unit) as DurationUnit })
        }
        placeholder="Unit"
        style={{ width: 130 }}
      >
        {durationUnits.map(option => (
          <Select.Item key={option} value={option}>
            {durationUnitLabel(option)}
          </Select.Item>
        ))}
      </Select.Root>
    </div>
  );
};
