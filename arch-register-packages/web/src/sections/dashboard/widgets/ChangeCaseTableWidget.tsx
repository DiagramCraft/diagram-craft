import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { toneColor } from '../../../components/bandColor';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { formatDate } from '../../../utils/dateFormat';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { GovernanceCaseDrawer } from '../../governance/GovernanceCaseDrawer';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import type { NeedsAttentionPriority } from './needsAttentionQueue';
import { useEntityCaseRegister } from './entityCaseRegister';
import { filterByStatus, isChangeCaseStatus } from './changeCaseTableLogic';
import styles from './ChangeCaseTableWidget.module.css';
import { TbGitPullRequest } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { Select } from '@diagram-craft/app-components/Select';
import { humanizeCaseKind } from '../../../utils/governanceCaseLabels';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { KNOWN_CASE_KINDS } from './NeedsAttentionWidget';
import type { NeedsAttentionSeverity } from './needsAttentionQueue';
import configFormStyles from '../WidgetConfigDialog.module.css';

export type ChangeCaseTableConfig = {
  /** Name of the entity schema the cases' subject entities must belong to. */
  schemaName: string;
  caseKinds: string[];
  severity: NeedsAttentionSeverity;
  /**
   * Only list cases in this status (`open`, `completed` or `cancelled`). Any other value —
   * including an unresolved or empty `$variable` from a dashboard sidebar — means no filter.
   */
  status?: string;
};

const PRIORITY_LABEL: Record<NeedsAttentionPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const PRIORITY_COLOR: Record<NeedsAttentionPriority, string | undefined> = {
  high: toneColor('bad'),
  medium: toneColor('warn'),
  low: undefined
};

/**
 * A register of governance cases (any case kinds) against entities of one schema, in
 * every status. The status filter comes from `config.status`, which a
 * dashboard's `options` sidebar can drive. Rows open the shared
 * `GovernanceCaseDrawer` through the `caseId` search param, which this widget also hosts.
 */
export const ChangeCaseTableWidget = ({ config }: { config: ChangeCaseTableConfig }) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const search = useSearch({ strict: false }) as { caseId?: string };
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  const status = isChangeCaseStatus(config.status) ? config.status : undefined;

  const schemaId = schemas.find(schema => schema.name === config.schemaName)?.id ?? null;
  const hasConfig = !!config.schemaName && config.caseKinds.length > 0;
  const register = useEntityCaseRegister(
    workspaceSlug,
    { schemaId, caseKinds: config.caseKinds },
    hasConfig
  );

  const rows = useMemo(() => filterByStatus(register.rows, status), [register.rows, status]);

  const patchCaseId = (caseId: string | undefined) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, caseId })
    } as Parameters<typeof navigate>[0]);

  if (!hasConfig) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }
  if (schemaId == null) {
    return (
      <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>
    );
  }

  const showRisk = config.severity === 'due-date';
  const columnCount = 6 + (showRisk ? 1 : 0);

  return (
    <div className={styles.root}>
      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Kind</Table.HeaderCell>
            <Table.HeaderCell>{config.schemaName}</Table.HeaderCell>
            <Table.HeaderCell>Requester</Table.HeaderCell>
            {showRisk && <Table.HeaderCell>Risk</Table.HeaderCell>}
            <Table.HeaderCell>Raised</Table.HeaderCell>
            <Table.HeaderCell>Due</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.EmptyRow colSpan={columnCount}>
              {register.isError
                ? 'Could not load change cases.'
                : register.isLoading
                  ? 'Loading change cases…'
                  : 'No change cases match these filters.'}
            </Table.EmptyRow>
          ) : (
            rows.map(row => (
              <Table.Row key={row.case.id} onClick={() => patchCaseId(row.case.id)}>
                <Table.Cell>{caseKindLabel(row.case.caseKind, row.case.payload)}</Table.Cell>
                <Table.NameCell title={row.entity._name} subtitle={row.entity._publicId} />
                <Table.Cell className={row.requesterName == null ? 'dim' : undefined}>
                  {row.requesterName ?? 'unknown'}
                </Table.Cell>
                {showRisk && (
                  <Table.Cell>
                    <Chip tone="ghost" color={PRIORITY_COLOR[row.risk]}>
                      {PRIORITY_LABEL[row.risk]}
                    </Chip>
                  </Table.Cell>
                )}
                <Table.Cell>
                  {formatDate(row.case.createdAt, '—', dateTimeFormatPreference)}
                </Table.Cell>
                <Table.Cell>{formatDate(row.case.dueAt, '—', dateTimeFormatPreference)}</Table.Cell>
                <Table.Cell>
                  <Chip tone="ghost">{row.case.status}</Chip>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {search.caseId && (
        <GovernanceCaseDrawer
          workspaceSlug={workspaceSlug}
          caseId={search.caseId}
          entityNoun={config.schemaName.toLowerCase()}
          onClose={() => patchCaseId(undefined)}
          onOpenDataset={publicId => {
            patchCaseId(undefined);
            openEntityDrawer(publicId);
          }}
        />
      )}
    </div>
  );
};

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
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}></div>
      </DialogSection>
    </>
  );
};

export const CHANGE_CASE_TABLE_TYPE = 'ChangeCaseTable' as const;

const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

/**
 * Dashboard-only table of governance cases (every status) against entities of a chosen
 * schema, restricted to a chosen set of case kinds — not tied to any particular app. Generalized
 * from Data Stewardship's former Change cases screen (#3504).
 */
export const changeCaseTableSpec: DashboardWidgetSpec<ChangeCaseTableConfig> = {
  icon: TbGitPullRequest,
  label: 'Change case table',
  description: 'Register of governance cases against entities of a chosen type, in any status.',
  defaultW: 12,
  defaultH: 20,
  surfaces: ['workspace'],
  component: ChangeCaseTableWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is ChangeCaseTableConfig =>
    typeof config.schemaName === 'string' &&
    Array.isArray(config.caseKinds) &&
    config.caseKinds.every(kind => typeof kind === 'string') &&
    (config.severity === 'none' || config.severity === 'due-date') &&
    isOptionalString(config.status),
  createDefaultConfig: () => ({
    schemaName: '',
    caseKinds: ['entity.change-case'],
    severity: 'due-date'
  }),
  configForm: ChangeCaseTableConfigForm
};
