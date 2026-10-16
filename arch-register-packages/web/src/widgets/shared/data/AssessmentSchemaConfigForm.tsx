import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_STATUS_LABEL,
  isAssessmentStatus
} from './assessmentSummaryLogic';
import type { EntityAssessmentStatus } from '../../../sections/entities/entityDrawer/entityAssessments';

type BaseConfig = { schemaName: string; label?: string };

type Props<C extends BaseConfig & { status?: EntityAssessmentStatus }> = {
  config: C;
  onChange: (config: C) => void;
  /** Whether `status` is required (stat) or an optional filter (table). */
  statusRequired: boolean;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

/** Shared config form for the assessment status stat and progress table widgets. */
export const AssessmentSchemaConfigForm = <
  C extends BaseConfig & { status?: EntityAssessmentStatus }
>({
  config,
  onChange,
  statusRequired
}: Props<C>) => {
  const { schemas } = useWorkspaceContext();
  return (
    <>
      <FormGroup label="Entity type" variant="simple">
        <Select.Root
          value={config.schemaName}
          onChange={value => onChange({ ...config, schemaName: value ?? '' })}
        >
          <Select.Item value="">Select an entity type…</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.name}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup
        label="Status"
        supplementaryLabel={statusRequired ? undefined : '(optional)'}
        variant="simple"
      >
        <Select.Root
          value={config.status ?? ''}
          onChange={value =>
            onChange({ ...config, status: value && isAssessmentStatus(value) ? value : undefined })
          }
        >
          {!statusRequired && <Select.Item value="">All statuses</Select.Item>}
          {ASSESSMENT_STATUSES.map(status => (
            <Select.Item key={status} value={status}>
              {ASSESSMENT_STATUS_LABEL[status]}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Title">
            <TextInput
              value={config.label ?? ''}
              placeholder="Use the widget name"
              style={{ width: '100%' }}
              onChange={value => onChange({ ...config, label: optionalText(value ?? '') })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
