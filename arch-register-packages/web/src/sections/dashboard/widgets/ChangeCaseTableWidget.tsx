import { useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Chip } from '../../../components/Chip';
import { SearchInput } from '../../../components/SearchInput';
import { Table } from '../../../components/table/Table';
import { toneColor } from '../../../components/bandColor';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { usePrincipalLabel, type PrincipalValue } from '../../../hooks/usePrincipalLabel';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { formatDate } from '../../../utils/dateFormat';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { GovernanceCaseDrawer } from '../../governance/GovernanceCaseDrawer';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import type { NeedsAttentionPriority, NeedsAttentionSeverity } from './needsAttentionQueue';
import { useEntityCaseRegister } from './entityCaseRegister';
import {
  CHANGE_CASE_STATUSES,
  countByStatus,
  filterChangeCaseRows,
  type ChangeCaseStatus
} from './changeCaseTableLogic';
import styles from './ChangeCaseTableWidget.module.css';

export type ChangeCaseTableConfig = {
  /** Name of the entity schema the cases' subject entities must belong to. */
  schemaName: string;
  caseKinds: string[];
  severity: NeedsAttentionSeverity;
  /** Singular label for the case subject, used as the column header and drawer noun. */
  entityLabel?: string;
  /** Key of a principal field on the entity to show as an extra column (e.g. a steward). */
  principalField?: string;
  /** Header of the principal column; defaults to the field key. */
  principalLabel?: string;
  label?: string;
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

const STATUS_FILTERS: ReadonlyArray<ChangeCaseStatus | undefined> = [
  undefined,
  ...CHANGE_CASE_STATUSES
];

/**
 * A searchable register of governance cases (any case kinds) against entities of one schema, in
 * every status. The search box and status chips are local state. Rows open the shared
 * `GovernanceCaseDrawer` through the `caseId` search param, which this widget also hosts.
 */
export const ChangeCaseTableWidget = ({ config }: { config: ChangeCaseTableConfig }) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const search = useSearch({ strict: false }) as { caseId?: string };
  const principalLabel = usePrincipalLabel();
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ChangeCaseStatus | undefined>(undefined);

  const schemaId = schemas.find(schema => schema.name === config.schemaName)?.id ?? null;
  const hasConfig = !!config.schemaName && config.caseKinds.length > 0;
  const register = useEntityCaseRegister(
    workspaceSlug,
    { schemaId, caseKinds: config.caseKinds },
    hasConfig
  );

  const counts = useMemo(() => countByStatus(register.rows), [register.rows]);
  const rows = useMemo(
    () => filterChangeCaseRows(register.rows, { status, query }),
    [register.rows, status, query]
  );

  const patchCaseId = (caseId: string | undefined) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, caseId })
    } as Parameters<typeof navigate>[0]);

  if (!hasConfig) {
    return <div className={`${styles.message} dim`}>This widget is not fully configured.</div>;
  }
  if (schemaId == null) {
    return <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>;
  }

  const entityLabel = config.entityLabel?.trim() || 'Entity';
  const showRisk = config.severity === 'due-date';
  const columnCount = 6 + (config.principalField ? 1 : 0) + (showRisk ? 1 : 0);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SearchInput
          size="sm"
          value={query}
          placeholder={`Search ${entityLabel.toLowerCase()}s, requesters…`}
          aria-label="Search"
          onChange={setQuery}
          onClear={() => setQuery('')}
        />
        <div className={styles.statusFilters}>
          {STATUS_FILTERS.map(value => (
            <button
              key={value ?? 'all'}
              type="button"
              className={`${styles.statusFilter} ${status === value ? styles.statusFilterActive : ''}`}
              data-testid={`change-case-table-status-${value ?? 'all'}`}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {value ?? 'All'}
              <span className="dim mono">
                {value ? counts[value] : register.rows.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Kind</Table.HeaderCell>
            <Table.HeaderCell>{entityLabel}</Table.HeaderCell>
            <Table.HeaderCell>Requester</Table.HeaderCell>
            {config.principalField && (
              <Table.HeaderCell>{config.principalLabel ?? config.principalField}</Table.HeaderCell>
            )}
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
                {config.principalField && (
                  <Table.Cell
                    className={row.entity[config.principalField] == null ? 'dim' : undefined}
                  >
                    {principalLabel(row.entity[config.principalField] as PrincipalValue) ??
                      'unassigned'}
                  </Table.Cell>
                )}
                {showRisk && (
                  <Table.Cell>
                    <Chip tone="ghost" color={PRIORITY_COLOR[row.risk]}>
                      {PRIORITY_LABEL[row.risk]}
                    </Chip>
                  </Table.Cell>
                )}
                <Table.Cell>{formatDate(row.case.createdAt, '—', dateTimeFormatPreference)}</Table.Cell>
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
          entityNoun={entityLabel.toLowerCase()}
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
