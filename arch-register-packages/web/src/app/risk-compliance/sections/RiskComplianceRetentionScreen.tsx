import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { Chip } from '../../../components/Chip';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { formatDate } from '../../../utils/dateFormat';
import { resolveRetentionConfig, resolveRetentionFieldIds } from '../riskComplianceQueries';
import { RISK_RAIL_PATHS, RISK_RETENTION_ID } from '../riskComplianceSections';
import { useRetentionAssignments, type RetentionAssignmentRow } from '../useRetentionAssignments';
import type { RetentionSearchParams } from '../../../routes/searchParams';
import styles from './RiskComplianceRetentionScreen.module.css';

const compareNullable = (a: number | string | null, b: number | string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

type SortKey = 'entity' | 'policy' | 'activatedFrom';

/**
 * The Retention section: a single register of Assignments ("Subject to Retention Policy"
 * relations), filtered by a sidebar Policy facet or the "Incomplete" data-quality facet
 * (`RiskComplianceSidebar.tsx`'s `RetentionSidebarContent`).
 *
 * This used to be a 3-view app (an expiry dashboard, a Policies library, and this Assignments
 * list) with a computed "expiry date" per assignment, bucketed into Overdue / Next 30 days / etc.
 * That was removed: `retention-assignment` links a policy to a Data Entity *category* (e.g.
 * "Customer Credentials"), not to an individual record, and its only date is `activated_from` —
 * one value for the whole category. `activated_from + policy.duration` is only ever "how long
 * this policy has nominally applied to this category", not "when the records in it are due for
 * disposal" — the records inside a category don't all share one creation date, so labelling a
 * category "Overdue" implied record-level actionability the data can't support. What's left is
 * what the data actually says: which categories are assigned to which policies, since when, and
 * for how long — a register, not a disposal queue. `policyPeriod` and `activatedFrom`
 * (`useRetentionAssignments.ts`) are reported as plain facts, not coloured by urgency.
 *
 * "Incomplete" (assignments missing a policy, duration, time unit, or activation date —
 * `useRetentionAssignments.ts`'s `missing`) is kept: unlike the expiry framing, it's a genuine
 * data-completeness signal — "can this assignment even be evaluated" — independent of the
 * category-vs-record issue above.
 */
export const RiskComplianceRetentionScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RetentionSearchParams;

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const retentionConfig = resolveRetentionConfig(configurations.data);
  const fieldIds = resolveRetentionFieldIds(configurations.data);
  const { rows, policyRows, isLoading } = useRetentionAssignments(
    workspaceSlug,
    retentionConfig,
    fieldIds
  );

  const filtered = useMemo(
    () =>
      rows.filter(row => {
        if (search.policy && row.policyId !== search.policy) return false;
        if (search.incomplete && row.missing.length === 0) return false;
        return true;
      }),
    [rows, search.policy, search.incomplete]
  );

  const comparators: Record<
    SortKey,
    (a: RetentionAssignmentRow, b: RetentionAssignmentRow) => number
  > = {
    entity: (a, b) => a.governedEntityName.localeCompare(b.governedEntityName),
    policy: (a, b) => a.policyName.localeCompare(b.policyName),
    activatedFrom: (a, b) => compareNullable(a.activatedFrom, b.activatedFrom)
  };
  const { sorted, sort, toggleSort } = useTableSort<RetentionAssignmentRow, SortKey>(
    filtered,
    comparators,
    { key: 'entity', dir: 'asc' }
  );

  const activePolicyName = search.policy
    ? (policyRows.find(policy => policy._uid === search.policy)?._name ?? null)
    : null;

  const patchSearch = (patch: Partial<RetentionSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_RETENTION_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading retention…</div>;
  }
  if (!retentionConfig || !fieldIds) {
    return (
      <div className={styles.empty}>
        Retention is not configured. Configure the retention capability in workspace settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title title="Retention" chips={!isLoading && <span>{filtered.length}</span>} />

      {(activePolicyName || search.incomplete) && (
        <div className={styles.toolbar}>
          {activePolicyName && (
            <Chip tone="ghost">
              {activePolicyName}
              <button
                type="button"
                className={styles.clearChip}
                aria-label="Clear policy filter"
                onClick={() => patchSearch({ policy: undefined })}
              >
                ×
              </button>
            </Chip>
          )}
          {search.incomplete && (
            <Chip tone="ghost">
              incomplete only
              <button
                type="button"
                className={styles.clearChip}
                aria-label="Clear incomplete filter"
                onClick={() => patchSearch({ incomplete: undefined })}
              >
                ×
              </button>
            </Chip>
          )}
        </div>
      )}

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.SortableHeaderCell sortKey="entity" sort={sort} onSort={toggleSort}>
              Governed entity
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="policy" sort={sort} onSort={toggleSort}>
              Policy
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Period</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="activatedFrom" sort={sort} onSort={toggleSort}>
              Activated from
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Complete</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={5}>
              {isLoading ? 'Loading assignments…' : 'No assignments match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(row => (
              <Table.Row key={row.uid}>
                <Table.NameCell
                  title={
                    <EntityNavigationLink publicId={row.governedEntityId} className={styles.entityLink}>
                      {row.governedEntityName}
                    </EntityNavigationLink>
                  }
                />
                <Table.Cell>
                  {row.policyId ? (
                    <EntityNavigationLink publicId={row.policyId} className={styles.entityLink}>
                      {row.policyName}
                    </EntityNavigationLink>
                  ) : (
                    row.policyName
                  )}
                </Table.Cell>
                <Table.Cell>{row.policyPeriod ?? '—'}</Table.Cell>
                <Table.Cell>{formatDate(row.activatedFrom)}</Table.Cell>
                <Table.Cell>
                  {row.missing.length === 0 ? (
                    <span className="dim">Yes</span>
                  ) : (
                    <Chip tone="ghost" title={`Missing ${row.missing.join(', ')}`}>
                      Missing {row.missing.join(', ')}
                    </Chip>
                  )}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <div className={styles.note}>
        Periods and activation dates come from the retention capability; a policy governs a category
        of data, not individual records, so this register reports what's assigned and since when —
        not a per-record disposal schedule.
      </div>
    </div>
  );
};
