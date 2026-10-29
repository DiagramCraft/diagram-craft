import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { KNOWN_CASE_KINDS } from '../../data-views/needs-attention/NeedsAttentionConfigForm';
import type { NeedsAttentionScope } from '../../data-views/needs-attention/needsAttentionQueue';
import { CASE_COUNT_TONES, CaseCountWidgetConfig } from './types';

const SCOPE_LABEL: Record<NeedsAttentionScope, string> = {
  workspace: 'Workspace-wide',
  mine: 'Assigned to me',
  late: 'Past due'
};

const TONE_LABEL: Record<(typeof CASE_COUNT_TONES)[number], string> = {
  none: 'None',
  warning: 'Warning',
  danger: 'Danger'
};

export const CaseCountConfigForm = ({
  config,
  onChange
}: {
  config: CaseCountWidgetConfig;
  onChange: (config: CaseCountWidgetConfig) => void;
}) => {
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
          value={config.schema}
          onChange={value => onChange({ ...config, schema: value ?? '' })}
        >
          <Select.Item value="">Choose an entity type…</Select.Item>
          {schemas.map(schema => (
            <Select.Item key={schema.id} value={schema.id}>
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
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
      </FormGroup>
      <FormGroup label="Scope" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={config.scope}
          onChange={value =>
            onChange({
              ...config,
              scope: (value as NeedsAttentionScope) ?? 'workspace'
            })
          }
        >
          {(Object.keys(SCOPE_LABEL) as NeedsAttentionScope[]).map(scope => (
            <Select.Item key={scope} value={scope}>
              {SCOPE_LABEL[scope]}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Colour when above zero">
            <Select.Root
              value={config.tone}
              onChange={value =>
                onChange({ ...config, tone: (value ?? 'none') as CaseCountWidgetConfig['tone'] })
              }
              style={{ width: '100%' }}
            >
              {CASE_COUNT_TONES.map(tone => (
                <Select.Item key={tone} value={tone}>
                  {TONE_LABEL[tone]}
                </Select.Item>
              ))}
            </Select.Root>
          </FormGrid.Row>
          <FormGrid.Row label={`Subtext ({count}, {due})`}>
            <TextInput
              value={config.subtextTemplate}
              style={{ width: '100%' }}
              onChange={value => onChange({ ...config, subtextTemplate: value ?? '' })}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Due within (days)">
            <NumberInput
              min={1}
              value={config.dueWithinDays}
              style={{ width: '80px' }}
              onChange={value => onChange({ ...config, dueWithinDays: Math.max(1, value || 7) })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
