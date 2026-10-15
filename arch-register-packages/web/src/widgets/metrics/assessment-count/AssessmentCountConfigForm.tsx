import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Select } from '@diagram-craft/app-components/Select';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { type AssessmentWidgetMode } from '../../data-views/assessments/assessmentsWidgetLogic';
import registrationStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { AssessmentCountWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

export const AssessmentCountConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentCountWidgetConfig;
  onChange: (config: AssessmentCountWidgetConfig) => void;
}) => {
  const { schemas } = useWorkspaceContext();
  const selected = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked ? [...selected, name] : selected.filter(existing => existing !== name);
    onChange({ ...config, schemaNames: next.length === 0 ? undefined : next });
  };

  return (
    <>
      <DialogSection label="Mode" required>
        <Select.Root
          value={config.mode}
          onChange={value =>
            onChange({ ...config, mode: (value ?? 'active') as AssessmentWidgetMode })
          }
        >
          <Select.Item value="active">Active</Select.Item>
          <Select.Item value="upcoming">Upcoming</Select.Item>
          <Select.Item value="overdue">Overdue</Select.Item>
          <Select.Item value="all">All</Select.Item>
        </Select.Root>
      </DialogSection>
      <DialogSection label="Scoped to entity types" required={false}>
        <div className={registrationStyles.options}>
          {schemas.map(schema => (
            <label key={schema.id} className={registrationStyles.optionRow}>
              <input
                type="checkbox"
                checked={selected.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
              <span className={registrationStyles.optionLabel}>{schema.name}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={registrationStyles.options}>
          <label className={registrationStyles.optionRow}>
            <span className={registrationStyles.optionLabel}>Due within (days)</span>
            <div className={registrationStyles.optionControl}>
              <input
                type="number"
                min={0}
                className={registrationStyles.labelInput}
                value={config.dueWithinDays ?? ''}
                placeholder="Any"
                onChange={event => {
                  const value = event.currentTarget.value;
                  onChange({ ...config, dueWithinDays: value === '' ? undefined : Number(value) });
                }}
              />
            </div>
          </label>
          <label className={registrationStyles.optionRow}>
            <span className={registrationStyles.optionLabel}>Subtext</span>
            <div className={registrationStyles.optionControl}>
              <input
                type="text"
                className={registrationStyles.labelInput}
                value={config.subtext ?? ''}
                onChange={event =>
                  onChange({ ...config, subtext: optionalText(event.currentTarget.value) })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
