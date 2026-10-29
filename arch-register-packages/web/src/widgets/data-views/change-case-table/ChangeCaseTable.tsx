import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { toneColor } from '../../../components/bandColor';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { formatDate } from '../../../utils/dateFormat';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { type NeedsAttentionPriority } from '../needs-attention/needsAttentionQueue';
import { useEntityCaseRegister } from '../../shared/data/entityCaseRegister';
import { filterByStatus, isChangeCaseStatus } from './changeCaseTableLogic';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import styles from './ChangeCaseTable.module.css';
import { ChangeCaseTableConfig } from './types';

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
 * `GovernanceCaseDrawer` through the workspace drawer stack.
 */
export const ChangeCaseTableWidget = ({ config }: { config: ChangeCaseTableConfig }) => {
  const framed = useWidgetFramed();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openCaseDrawer } = useEntityDrawer();
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  const status = isChangeCaseStatus(config.status) ? config.status : undefined;

  const schemaId = schemas.find(schema => schema.name === config.schemaName)?.id ?? null;
  const register = useEntityCaseRegister(workspaceSlug, { schemaId, caseKinds: config.caseKinds });

  const rows = useMemo(() => filterByStatus(register.rows, status), [register.rows, status]);

  if (schemaId == null) {
    return (
      <div className={`${styles.message} dim`}>Entity type “{config.schemaName}” not found.</div>
    );
  }

  const showRisk = config.severity === 'due-date';
  const columnCount = 6 + (showRisk ? 1 : 0);

  return (
    <div className={styles.root}>
      <Table.Root scroll stickyHeader bordered={!framed}>
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
              <Table.Row key={row.case.id} onClick={() => openCaseDrawer(row.case.id)}>
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
    </div>
  );
};
