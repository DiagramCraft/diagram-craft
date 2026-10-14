import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { useNeedsAttentionQueue } from './needsAttentionQueue';
import { NeedsAttentionList } from './NeedsAttentionList';
import { TbAlertTriangle } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import type { NeedsAttentionScope, NeedsAttentionSeverity } from './needsAttentionQueue';
import configFormStyles from '../WidgetConfigDialog.module.css';

export type NeedsAttentionWidgetConfig = {
  schema: string;
  caseKinds: string[];
  scope: NeedsAttentionScope;
  severity: NeedsAttentionSeverity;
  limit: number;
};

type Props = {
  config: NeedsAttentionWidgetConfig;
};

export const NeedsAttentionWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const hasConfig = !!config.schema && config.caseKinds.length > 0;

  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: config.schema || null, caseKinds: config.caseKinds, scope: config.scope },
    hasConfig
  );

  if (!hasConfig) {
    return <div className="dim">This widget is not fully configured.</div>;
  }

  return (
    <NeedsAttentionList
      items={queue.items}
      isLoading={queue.isLoading}
      isError={queue.isError}
      severity={config.severity}
      limit={config.limit}
      onOpenEntity={openEntityDrawer}
    />
  );
};

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
            onChange({ ...config, scope: (value as NeedsAttentionScope) ?? 'workspace' })
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

export const NEEDS_ATTENTION_TYPE = 'NeedsAttentionQueue' as const;

const isScope = (value: unknown): value is NeedsAttentionWidgetConfig['scope'] =>
  value === 'workspace' || value === 'mine' || value === 'late';

const isSeverity = (value: unknown): value is NeedsAttentionWidgetConfig['severity'] =>
  value === 'none' || value === 'due-date';

/**
 * Dashboard-only widget: a queue of open governance cases against entities of a chosen schema,
 * restricted to a chosen set of case kinds — not tied to any particular app. Generalized from
 * API & Integration Catalog's and Data Stewardship's independently-built "needs attention" queues
 * (#3466); see `needsAttentionQueue.ts` for the shared query/join/severity logic.
 */
export const needsAttentionSpec = defineComponent({
  type: NEEDS_ATTENTION_TYPE,
  category: 'data-views',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'Needs attention queue',
    description: 'Open governance cases against entities of a chosen type, awaiting a decision.',
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: NeedsAttentionWidget,
    frame: { padded: false, showIcon: false },
    isValidConfig: (config): config is NeedsAttentionWidgetConfig =>
      typeof config.schema === 'string' &&
      Array.isArray(config.caseKinds) &&
      config.caseKinds.every(kind => typeof kind === 'string') &&
      isScope(config.scope) &&
      isSeverity(config.severity) &&
      typeof config.limit === 'number' &&
      config.limit > 0,
    createDefaultConfig: () => ({
      schema: '',
      caseKinds: ['entity.change-case', 'entity.deprecation'],
      scope: 'workspace',
      severity: 'due-date',
      limit: 8
    }),
    configForm: NeedsAttentionConfigForm
  }
});
