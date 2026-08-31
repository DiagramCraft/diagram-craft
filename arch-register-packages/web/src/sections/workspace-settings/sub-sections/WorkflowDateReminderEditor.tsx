import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { FieldDateReminderExtension } from '@arch-register/api-types/governanceCaseConfigSchemas';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowDateReminderEditorProps = {
  extension: FieldDateReminderExtension;
  principalFields: Array<{ id: string; name: string }>;
  onChange: (extension: FieldDateReminderExtension) => void;
};

const UNITS = ['days', 'months', 'years'] as const;

export const WorkflowDateReminderEditor = ({
  extension,
  principalFields,
  onChange
}: WorkflowDateReminderEditorProps) => {
  const advance = extension.completionAdvance;
  return (
    <>
      <FormElement label="Route reminder to field">
        <Select.Root
          value={extension.routing?.principalFieldId}
          onChange={value =>
            onChange({
              ...extension,
              routing: {
                fallbackUserIds: extension.routing?.fallbackUserIds ?? [],
                fallbackTeamIds: extension.routing?.fallbackTeamIds ?? [],
                principalFieldId: value
              }
            })
          }
          placeholder="Owning team (default)"
        >
          {principalFields.map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
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
