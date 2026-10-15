import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { type NeedsAttentionScope, type NeedsAttentionSeverity } from './needsAttentionQueue';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
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
      <DialogSection label="Entity type">
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
      </DialogSection>
      <DialogSection label="Case kinds">
        <div className={configFormStyles.options}>
          {KNOWN_CASE_KINDS.map(kind => (
            <label key={kind} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
              <span className={configFormStyles.optionLabel}>{humanizeCaseKind(kind)}</span>
            </label>
          ))}
          {otherKinds.map(kind => (
            <label key={kind} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
              <span className={configFormStyles.optionLabel}>{humanizeCaseKind(kind)}</span>
            </label>
          ))}
          <div className={configFormStyles.optionRow}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={customKind}
              placeholder="Other case kind…"
              onChange={event => setCustomKind(event.currentTarget.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustomKind();
                }
              }}
            />
            <button type="button" className={configFormStyles.labelInput} onClick={addCustomKind}>
              Add
            </button>
          </div>
        </div>
      </DialogSection>
      <DialogSection label="Scope" required={false}>
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
      </DialogSection>
      <DialogSection label="Priority" required={false}>
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
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Show</span>
            <div className={configFormStyles.optionControl}>
              <input
                type="number"
                min={1}
                max={20}
                className={configFormStyles.labelInput}
                value={config.limit}
                onChange={event =>
                  onChange({
                    ...config,
                    limit: Math.max(1, Number(event.currentTarget.value) || 8)
                  })
                }
              />
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
