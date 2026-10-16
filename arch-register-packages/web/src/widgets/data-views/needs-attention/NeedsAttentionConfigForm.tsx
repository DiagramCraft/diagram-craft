import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Button } from '@diagram-craft/app-components/Button';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { type NeedsAttentionScope, type NeedsAttentionSeverity } from './needsAttentionQueue';
import { NeedsAttentionWidgetConfig } from './types';

/** Case kinds with a real backing case model in this codebase — not an enum, just known ones to
 * offer without requiring a user to type a raw case-kind string from scratch. */
export const KNOWN_CASE_KINDS = ['entity.change-case', 'entity.deprecation', 'field-date-reminder'];

const SCOPE_LABEL: Record<NeedsAttentionScope, string> = {
  workspace: 'Workspace-wide',
  mine: 'Assigned to me',
  late: 'Past due'
};

const SEVERITY_LABEL: Record<NeedsAttentionSeverity, string> = {
  none: 'None',
  'due-date': 'Derived from due date'
};

type NeedsAttentionConfigFormProps = {
  config: NeedsAttentionWidgetConfig;
  onChange: (config: NeedsAttentionWidgetConfig) => void;
};

export const NeedsAttentionConfigForm = ({ config, onChange }: NeedsAttentionConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const [customKind, setCustomKind] = useState('');

  const toggleKind = (kind: string, checked: boolean) => {
    const next = checked
      ? [...config.caseKinds, kind]
      : config.caseKinds.filter(existing => existing !== kind);
    onChange({ ...config, caseKinds: next });
  };

  const addCustomKind = () => {
    const kind = customKind.trim();
    if (kind.length === 0 || config.caseKinds.includes(kind)) return;
    onChange({ ...config, caseKinds: [...config.caseKinds, kind] });
    setCustomKind('');
  };

  const otherKinds = config.caseKinds.filter(kind => !KNOWN_CASE_KINDS.includes(kind));

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
          {[...KNOWN_CASE_KINDS, ...otherKinds].map(kind => (
            <FormCheckboxList.Row key={kind} label={humanizeCaseKind(kind)}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
            </FormCheckboxList.Row>
          ))}
        </FormCheckboxList>
        <div style={{ display: 'flex', gap: '8px' }}>
          <TextInput
            value={customKind}
            placeholder="Other case kind…"
            style={{ flex: 1 }}
            onChange={value => setCustomKind(value ?? '')}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomKind();
              }
            }}
          />
          <Button variant="secondary" onClick={addCustomKind}>
            Add
          </Button>
        </div>
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
      <FormGroup label="Priority" supplementaryLabel="(optional)" variant="simple">
        <Select.Root
          value={config.severity}
          onChange={value =>
            onChange({
              ...config,
              severity: (value as NeedsAttentionSeverity) ?? 'none'
            })
          }
        >
          {(Object.keys(SEVERITY_LABEL) as NeedsAttentionSeverity[]).map(severity => (
            <Select.Item key={severity} value={severity}>
              {SEVERITY_LABEL[severity]}
            </Select.Item>
          ))}
        </Select.Root>
      </FormGroup>
      <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Show">
            <NumberInput
              min={1}
              max={20}
              value={config.limit}
              style={{ width: '80px' }}
              onChange={value => onChange({ ...config, limit: Math.max(1, value || 8) })}
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
