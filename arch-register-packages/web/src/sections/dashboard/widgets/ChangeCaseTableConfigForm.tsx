import { Select } from '@diagram-craft/app-components/Select';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { KNOWN_CASE_KINDS } from './NeedsAttentionConfigForm';
import type { ChangeCaseTableConfig } from './ChangeCaseTableWidget';
import type { NeedsAttentionSeverity } from './needsAttentionQueue';
import styles from '../WidgetConfigDialog.module.css';

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const SEVERITY_LABEL: Record<NeedsAttentionSeverity, string> = {
  none: 'None',
  'due-date': 'Derived from due date'
};

type Props = {
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
  <label className={styles.optionRow}>
    <span className={styles.optionLabel}>{label}</span>
    <div className={styles.optionControl}>
      <input
        type="text"
        className={styles.labelInput}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={event => onChange(optionalText(event.currentTarget.value))}
      />
    </div>
  </label>
);

export const ChangeCaseTableConfigForm = ({ config, onChange }: Props) => {
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
          className={styles.labelInput}
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
        <div className={styles.options}>
          {[
            ...KNOWN_CASE_KINDS,
            ...config.caseKinds.filter(kind => !KNOWN_CASE_KINDS.includes(kind))
          ].map(kind => (
            <label key={kind} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={config.caseKinds.includes(kind)}
                onChange={event => toggleKind(kind, event.currentTarget.checked)}
              />
              <span className={styles.optionLabel}>{humanizeCaseKind(kind)}</span>
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
        <div className={styles.options}>
          <TextOption
            label="Status"
            value={config.status}
            placeholder="open, completed, cancelled or $variable"
            onChange={status => onChange({ ...config, status })}
          />
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={styles.options}>
          <TextOption
            label="Title"
            value={config.label}
            placeholder="Change cases"
            onChange={label => onChange({ ...config, label })}
          />
        </div>
      </DialogSection>
    </>
  );
};
