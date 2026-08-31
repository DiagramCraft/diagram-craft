import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { FieldDateReminderExtension } from '@arch-register/api-types/governanceCaseConfigSchemas';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowDateReminderEditorProps = {
  extension: FieldDateReminderExtension;
  onChange: (extension: FieldDateReminderExtension) => void;
};

const UNITS = ['days', 'months', 'years'] as const;

export const WorkflowDateReminderEditor = ({
  extension,
  onChange
}: WorkflowDateReminderEditorProps) => {
  const advance = extension.completionAdvance;
  return (
    <>
      <label className={styles.check}>
        <Checkbox
          value={advance != null}
          onChange={checked =>
            onChange({
              ...extension,
              completionAdvance: checked ? (advance ?? { amount: 1, unit: 'years' }) : undefined
            })
          }
        />
        Advance the date on completion so the review recurs
      </label>
      {advance != null && (
        <div className={styles.formGrid}>
          <FormElement label="Amount">
            <TextInput
              type="number"
              value={String(advance.amount)}
              onChange={value =>
                onChange({
                  ...extension,
                  completionAdvance: { ...advance, amount: Math.max(1, Number(value ?? 1) || 1) }
                })
              }
            />
          </FormElement>
          <FormElement label="Unit">
            <Select.Root
              value={advance.unit}
              onChange={value =>
                onChange({
                  ...extension,
                  completionAdvance: {
                    ...advance,
                    unit: (value as (typeof UNITS)[number]) ?? 'years'
                  }
                })
              }
            >
              {UNITS.map(unit => (
                <Select.Item key={unit} value={unit}>
                  {unit}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        </div>
      )}
    </>
  );
};
