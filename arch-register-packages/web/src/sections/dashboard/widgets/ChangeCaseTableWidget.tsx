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
import type { NeedsAttentionPriority, NeedsAttentionSeverity } from './needsAttentionQueue';
import { useEntityCaseRegister } from './entityCaseRegister';
import { filterByStatus, isChangeCaseStatus } from './changeCaseTableLogic';
import styles from './ChangeCaseTableWidget.module.css';

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
    return <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>;
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
