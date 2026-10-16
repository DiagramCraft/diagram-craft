import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { KNOWN_CASE_KINDS } from '../needs-attention/NeedsAttentionConfigForm';
import { type NeedsAttentionSeverity } from '../needs-attention/needsAttentionQueue';
import { ChangeCaseTableConfig } from './types';

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

const SEVERITY_LABEL: Record<NeedsAttentionSeverity, string> = {
  none: 'None',
  'due-date': 'Derived from due date'
};

type ChangeCaseTableConfigFormProps = {
  config: ChangeCaseTableConfig;
  onChange: (config: ChangeCaseTableConfig) => void;
};

const TextOption = ({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}) => (
  <FormGrid.Row label={label}>
    <TextInput
      value={value ?? ''}
      placeholder={placeholder}
      style={{ width: '100%' }}
      onChange={v => onChange(optionalText(v))}
    />
  </FormGrid.Row>
);

export const ChangeCaseTableConfigForm = ({ config, onChange }: ChangeCaseTableConfigFormProps) => {
  const { schemas } = useWorkspaceContext();

  const toggleKind = (kind: string, checked: boolean) =>
    onChange({
      ...config,
      caseKinds: checked
        ? [...config.caseKinds, kind]
        : config.caseKinds.filter(existing => existing !== kind)
    });

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
      <FormGroup label="Case kinds" variant="simple">
        <FormCheckboxList>
          {[
            ...KNOWN_CASE_KINDS,
            ...config.caseKinds.filter(kind => !KNOWN_CASE_KINDS.includes(kind))
          ].map(kind => (
            <FormCheckboxList.Row key={kind} label={humanizeCaseKind(kind)}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Priority" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={config.severity}
          onChange={value =>
            onChange({ ...config, severity: (value as NeedsAttentionSeverity) ?? 'none' })
          }
        >
          {(Object.keys(SEVERITY_LABEL) as NeedsAttentionSeverity[]).map(severity => (
            <Select.Item key={severity} value={severity}>
              {SEVERITY_LABEL[severity]}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Status filter" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <TextOption
            label="Status"
            value={config.status}
            placeholder="open, completed, cancelled or $variable"
            onChange={status => onChange({ ...config, status })}
          />
        </FormGrid>
      </FormGroup>
    </>
  );
};
