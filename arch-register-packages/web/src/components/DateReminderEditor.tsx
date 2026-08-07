import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
export type DateFieldReminder = {
  enabled: boolean;
  approachingDays: number[];
  overdueDays: number[];
};

export const DEFAULT_APPROACHING_DAYS = [3];
export const DEFAULT_OVERDUE_DAYS = [1];

const parseDays = (value: string): number[] =>
  value
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => Number(part))
    .filter((day, index, days) => Number.isInteger(day) && day >= 0 && days.indexOf(day) === index);

const formatDays = (days: number[]): string => days.join(', ');

export const DateReminderEditor = ({
  value,
  onChange,
  disabled
}: {
  value?: DateFieldReminder;
  onChange: (value: DateFieldReminder | undefined) => void;
  disabled?: boolean;
}) => {
  const enabled = value?.enabled ?? false;
  const approachingDays = value?.approachingDays ?? DEFAULT_APPROACHING_DAYS;
  const overdueDays = value?.overdueDays ?? DEFAULT_OVERDUE_DAYS;

  const setEnabled = (nextEnabled: boolean) => {
    onChange(
      nextEnabled
        ? {
            enabled: true,
            approachingDays,
            overdueDays
          }
        : undefined
    );
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={event => setEnabled(event.target.checked)}
        />
        <span>Automatic reminders</span>
      </label>
      {enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          <FormElement label="Days before date">
            <TextInput
              value={formatDays(approachingDays)}
              disabled={disabled}
              onChange={next =>
                onChange({
                  enabled: true,
                  approachingDays: parseDays(next ?? ''),
                  overdueDays
                })
              }
              placeholder="e.g. 3, 7"
            />
          </FormElement>
          <FormElement label="Days after date">
            <TextInput
              value={formatDays(overdueDays)}
              disabled={disabled}
              onChange={next =>
                onChange({
                  enabled: true,
                  approachingDays,
                  overdueDays: parseDays(next ?? '')
                })
              }
              placeholder="e.g. 1, 3"
            />
          </FormElement>
        </div>
      )}
    </div>
  );
};
