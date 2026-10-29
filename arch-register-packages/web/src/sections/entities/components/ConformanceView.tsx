import { useMemo, useState } from 'react';
import { TbShieldCheck } from 'react-icons/tb';
import { SeverityBadge, ViolationStatusChip } from '../../../components/ConformanceBadges';
import {
  CONFORMANCE_SEVERITY_OPTIONS,
  CONFORMANCE_STATUS_OPTIONS
} from '../../../components/conformanceOptions';
import { EmptyState } from '../../../components/EmptyState';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { LoadingState } from '../../../components/LoadingState';
import { Table } from '../../../components/table/Table';
import { ViewControls, ViewControlsFrame } from '../../../components/ViewControls';
import { useConformanceChecks, useConformanceViolations } from '../../../hooks/useConformance';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { formatDateTime } from '../../../utils/dateFormat';
import {
  DEFAULT_ENTITY_CONFORMANCE_FILTERS,
  toViolationQuery,
  type EntityConformanceFilters
} from '../entityConformanceFilters';
import { entityName } from './entityBrowserViewShared';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';

// The violations API caps a page at 200; the view joins one page onto the browser's rows.
const FETCH_LIMIT = 200;

/**
 * Joins conformance violations onto the entities matching the browser's search and filters, one
 * row per violation. Only violations of entities in `rows` are shown.
 */
export const ConformanceView = ({
  rows,
  onEntityClick,
  hideToolbar
}: EntityBrowserRowViewProps & { hideToolbar?: boolean }) => {
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const canView = permissions.canViewSchemas;
  const [filters, setFilters] = useState<EntityConformanceFilters>(
    DEFAULT_ENTITY_CONFORMANCE_FILTERS
  );
  const { data: checks = [] } = useConformanceChecks(workspaceSlug, canView);

  const schemaIds = useMemo(() => new Set(rows.map(row => row._schema.id)), [rows]);
  const schemaId = schemaIds.size === 1 ? [...schemaIds][0] : undefined;
  const { data, isLoading } = useConformanceViolations(
    workspaceSlug,
    toViolationQuery({ ...filters, schemaId: schemaId ?? '' }, { limit: FETCH_LIMIT, offset: 0 }),
    canView
  );

  const joined = useMemo(() => {
    const byUid = new Map(rows.map(row => [row._uid, row]));
    return (data?.items ?? [])
      .flatMap(violation => {
        const entity = byUid.get(violation.entity_id);
        return entity ? [{ violation, entity }] : [];
      })
      .sort((a, b) => entityName(a.entity).localeCompare(entityName(b.entity)));
  }, [rows, data]);

  if (!canView) {
    return <EmptyState title="You do not have access to conformance." compact />;
  }

  return (
    <ViewControlsFrame>
      {!hideToolbar && (
        <ViewControls variant="view">
          <LabeledSelect
            label="Status"
            value={filters.status}
            onChange={value =>
              setFilters(previous => ({
                ...previous,
                status: value as EntityConformanceFilters['status']
              }))
            }
            options={CONFORMANCE_STATUS_OPTIONS}
          />
          <LabeledSelect
            label="Severity"
            value={filters.severity}
            onChange={value =>
              setFilters(previous => ({
                ...previous,
                severity: value as EntityConformanceFilters['severity']
              }))
            }
            options={CONFORMANCE_SEVERITY_OPTIONS}
          />
          <LabeledSelect
            label="Check"
            value={filters.checkId}
            onChange={value => setFilters(previous => ({ ...previous, checkId: value }))}
            options={[
              { value: '', label: 'All checks' },
              ...checks.map(check => ({ value: check.id, label: check.name }))
            ]}
          />
        </ViewControls>
      )}
      {isLoading || !data ? (
        <LoadingState text="Loading conformance…" size="sm" />
      ) : joined.length === 0 ? (
        <EmptyState
          framed
          icon={<TbShieldCheck size={20} />}
          tone="good"
          title="No violations"
          subtitle="None of the matching entities have violations for the current filters."
        />
      ) : (
        <>
          <Table.Root layout="fixed" bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Entity</Table.HeaderCell>
                <Table.HeaderCell width={140}>Type</Table.HeaderCell>
                <Table.HeaderCell>Check</Table.HeaderCell>
                <Table.HeaderCell width={90}>Severity</Table.HeaderCell>
                <Table.HeaderCell width={140}>Status</Table.HeaderCell>
                <Table.HeaderCell>Message</Table.HeaderCell>
                <Table.HeaderCell width={150}>Last seen</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {joined.map(({ violation, entity }) => (
                <Table.Row key={violation.id} onClick={() => onEntityClick(entity._publicId)}>
                  <Table.Cell>{entityName(entity)}</Table.Cell>
                  <Table.Cell>{entity._schema.name}</Table.Cell>
                  <Table.Cell>{violation.check_name}</Table.Cell>
                  <Table.Cell>
                    <SeverityBadge severity={violation.severity} />
                  </Table.Cell>
                  <Table.Cell>
                    <ViolationStatusChip status={violation.status} />
                  </Table.Cell>
                  <Table.Cell>{violation.message}</Table.Cell>
                  <Table.Cell>{formatDateTime(violation.last_seen_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {data.total > FETCH_LIMIT && (
            <EmptyState
              compact
              title={`Showing the first ${FETCH_LIMIT} of ${data.total} violations`}
            />
          )}
        </>
      )}
    </ViewControlsFrame>
  );
};
