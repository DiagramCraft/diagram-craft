import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { type AssessmentWidgetMode } from './assessmentsWidgetLogic';
import { Select } from '@diagram-craft/app-components/Select';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { AssessmentsWidgetConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

type AssessmentsConfigFormProps = {
  config: AssessmentsWidgetConfig;
  onChange: (config: AssessmentsWidgetConfig) => void;
};

export const AssessmentsConfigForm = ({ config, onChange }: AssessmentsConfigFormProps) => {
  const { assessmentTypes, schemas } = useWorkspaceContext();
  const selectedSchemas = config.schemaNames ?? [];
  const toggleSchema = (name: string, checked: boolean) => {
    const next = checked
      ? [...selectedSchemas, name]
      : selectedSchemas.filter(existing => existing !== name);
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
      <DialogSection label="Assessment type" required={false}>
        <Select.Root
          value={config.assessmentTypeId ?? ''}
          onChange={value => onChange({ ...config, assessmentTypeId: optionalText(value ?? '') })}
        >
          <Select.Item value="">Any assessment type</Select.Item>
          {assessmentTypes.map(type => (
            <Select.Item key={type.id} value={type.id}>
              {type.name}
            </Select.Item>
          ))}
        </Select.Root>
      </DialogSection>
      <DialogSection label="Scoped to entity types" required={false}>
        <div className={configFormStyles.options}>
          {schemas.map(schema => (
            <label key={schema.id} className={configFormStyles.optionRow}>
              <input
                type="checkbox"
                checked={selectedSchemas.includes(schema.name)}
                onChange={event => toggleSchema(schema.name, event.currentTarget.checked)}
              />
              <span className={configFormStyles.optionLabel}>{schema.name}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <input
              type="checkbox"
              checked={config.relativeDue ?? false}
              onChange={event =>
                onChange({ ...config, relativeDue: event.currentTarget.checked || undefined })
              }
            />
            <span className={configFormStyles.optionLabel}>Day-count due labels and project</span>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
