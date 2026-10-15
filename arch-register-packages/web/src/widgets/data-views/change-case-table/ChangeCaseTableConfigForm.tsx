import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { KNOWN_CASE_KINDS } from '../needs-attention/NeedsAttentionConfigForm';
import { type NeedsAttentionSeverity } from '../needs-attention/needsAttentionQueue';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { ChangeCaseTableConfig } from './types';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

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
  <label className={configFormStyles.optionRow}>
    <span className={configFormStyles.optionLabel}>{label}</span>
    <div className={configFormStyles.optionControl}>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={event => onChange(optionalText(event.currentTarget.value))}
      />
    </div>
  </label>
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
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(schema => (
            <option key={schema.id} value={schema.name}>
              {schema.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Case kinds" required>
        <div className={configFormStyles.options}>
          {[
            ...KNOWN_CASE_KINDS,
            ...config.caseKinds.filter(kind => !KNOWN_CASE_KINDS.includes(kind))
          ].map(kind => (
            <label key={kind} className={configFormStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
              <span className={configFormStyles.optionLabel}>{humanizeCaseKind(kind)}</span>
            </label>
          ))}
        </div>
      </DialogSection>
      <DialogSection label="Priority" required={false}>
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
      </DialogSection>
      <DialogSection label="Status filter" required={false}>
        <div className={configFormStyles.options}>
          <TextOption
            label="Status"
            value={config.status}
            placeholder="open, completed, cancelled or $variable"
            onChange={status => onChange({ ...config, status })}
          />
        </div>
      </DialogSection>
    </>
  );
};
