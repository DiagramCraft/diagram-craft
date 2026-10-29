import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { KNOWN_CASE_KINDS } from '../../data-views/needs-attention/NeedsAttentionConfigForm';
import { DateCalendarWidgetConfig } from './types';

type DateCalendarConfigFormProps = {
  config: DateCalendarWidgetConfig;
  onChange: (config: DateCalendarWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

const CaseSourceForm = ({ config, onChange }: DateCalendarConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const cases = config.cases!;
  const patch = (next: Partial<NonNullable<DateCalendarWidgetConfig['cases']>>) =>
    onChange({ ...config, cases: { ...cases, ...next } });
  return (
    <>
      <FormGroup label="Entity type" variant="simple">
        <Select.Root
          value={cases.schemaName}
          onChange={value => patch({ schemaName: value ?? '' })}
        >
          <Select.Item value="">Choose an entity type…</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.name}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Case kinds" variant="simple">
        <FormCheckboxList>
          {KNOWN_CASE_KINDS.map(kind => (
            <FormCheckboxList.Row key={kind} label={humanizeCaseKind(kind)}>
              <input
                type="checkbox"
                checked={cases.caseKinds.includes(kind)}
                onChange={e =>
                  patch({
                    caseKinds: e.target.checked
                      ? [...cases.caseKinds, kind]
                      : cases.caseKinds.filter(existing => existing !== kind)
                  })
                }
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Scope" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={cases.scope ?? 'workspace'}
          onChange={value =>
            patch({ scope: (value ?? 'workspace') as 'workspace' | 'mine' | 'late' })
          }
        >
          <Select.Item value="workspace">Workspace-wide</Select.Item>
          <Select.Item value="mine">Assigned to me</Select.Item>
          <Select.Item value="late">Past due</Select.Item>
        </Select.Root>
      </FormGroup>
    </>
  );
};

export const DateCalendarConfigForm = ({ config, onChange }: DateCalendarConfigFormProps) => (
  <>
    <FormGroup label="Source" supplementaryLabel="(optional)" variant="simple">
      <Select.Root
        value={config.cases ? 'cases' : 'query'}
        onChange={value =>
          onChange({
            ...config,
            cases:
              value === 'cases'
                ? {
                    schemaName: '',
                    caseKinds: ['entity.change-case', 'entity.deprecation']
                  }
                : undefined
          })
        }
      >
        <Select.Item value="query">Records (query)</Select.Item>
        <Select.Item value="cases">Governance cases (by due date)</Select.Item>
      </Select.Root>
    </FormGroup>
    {config.cases ? (
      <CaseSourceForm config={config} onChange={onChange} />
    ) : (
      <>
        <FormGroup
          label="Records (query)"
          supplementaryLabel={config.entityQuery === undefined ? undefined : '(optional)'}
          variant="simple"
        >
          <TextInput
            value={config.query ?? ''}
            placeholder='e.g. schema:"Contract"'
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, query: value ?? '' })}
          />
        </FormGroup>
        <FormGroup label="Date field id" variant="simple">
          <TextInput
            value={config.dateFieldId}
            placeholder="e.g. contract_end"
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, dateFieldId: value ?? '' })}
          />
        </FormGroup>
      </>
    )}
    <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Period">
          <Select.Root
            value={config.period ?? 'month'}
            onChange={value => onChange({ ...config, period: value === 'week' ? 'week' : 'month' })}
          >
            <Select.Item value="month">Month</Select.Item>
            <Select.Item value="week">Week</Select.Item>
          </Select.Root>
        </FormGrid.Row>
        <FormGrid.Row label="Number of periods">
          <NumberInput
            min={1}
            max={36}
            value={config.periodCount ?? 12}
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, periodCount: Math.max(1, value ?? 12) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Subtitle field id">
          <TextInput
            value={config.sublabelFieldId ?? ''}
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, sublabelFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Value field id">
          <TextInput
            value={config.valueFieldId ?? ''}
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, valueFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Warn within (days)">
          <NumberInput
            min={0}
            value={config.warnWithinDays ?? ''}
            placeholder="30"
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, warnWithinDays: value })}
          />
        </FormGrid.Row>
      </FormGrid>
    </FormGroup>
  </>
);
