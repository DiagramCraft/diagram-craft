import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import type { DocumentField } from '@arch-register/api-types/documentContract';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowStatusValuesEditorProps = {
  options: NonNullable<DocumentField['enumOptions']>;
  statusValues: string[];
  onChange: (statusValues: string[]) => void;
};

export const WorkflowStatusValuesEditor = ({
  options,
  statusValues,
  onChange
}: WorkflowStatusValuesEditorProps) => (
  <div className={styles.statusValues}>
    <div className={styles.hint}>
      Select the enum values that require the shared approval policy.
    </div>
    {options.map(option => (
      <label className={styles.check} key={option.value}>
        <Checkbox
          value={statusValues.includes(option.value)}
          onChange={checked =>
            onChange(
              checked
                ? [...statusValues, option.value]
                : statusValues.filter(value => value !== option.value)
            )
          }
        />
        {option.label}
      </label>
    ))}
  </div>
);
