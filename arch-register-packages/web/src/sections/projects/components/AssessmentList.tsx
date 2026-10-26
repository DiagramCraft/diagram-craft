import { useMemo } from 'react';
import { TbClipboardList, TbPlus } from 'react-icons/tb';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../../components/TypeBadge';
import { EmptyState } from '../../../components/EmptyState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { stableHue } from '../../../components/MemberAvatar';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { ToolbarFilterBar, ToolbarFilterSelect } from '../../../components/ToolbarFilter';
import styles from '../ProjectAssessments.module.css';

export type StatusFilter = 'default' | 'draft' | 'archived' | 'all';

const STATUS_LABEL: Record<Assessment['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived'
};

const emptyStateTitle: Record<StatusFilter, string> = {
  default: 'No open or closed assessments',
  draft: 'No draft assessments',
  archived: 'No archived assessments',
  all: 'No assessments yet'
};

export const AssessmentListToolbar = ({
  statusFilter,
  counts,
  onStatusFilterChange
}: {
  statusFilter: StatusFilter;
  counts: Record<StatusFilter, number>;
  onStatusFilterChange: (filter: StatusFilter) => void;
}) => (
  <ToolbarFilterBar>
    <ToolbarFilterSelect
      label="Status"
      value={statusFilter}
      onChange={value => onStatusFilterChange(value as StatusFilter)}
      options={[
        { value: 'default', label: `Open / Closed (${counts.default})` },
        { value: 'draft', label: `Draft (${counts.draft})` },
        { value: 'archived', label: `Archived (${counts.archived})` },
        { value: 'all', label: `All (${counts.all})` }
      ]}
    />
  </ToolbarFilterBar>
);

export const AssessmentList = ({
  assessments,
  statusFilter,
  schemas,
  canEdit,
  onCreate,
  onOpen
}: {
  assessments: Assessment[];
  statusFilter: StatusFilter;
  schemas: EntitySchema[];
  canEdit: boolean;
  onCreate: () => void;
  onOpen: (assessmentId: string) => void;
}) => {
  const filtered = assessments.filter(assessment => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'default')
      return assessment.status === 'open' || assessment.status === 'closed';
    return assessment.status === statusFilter;
  });

  const schemaColorMap = useMemo(() => {
    const map = new Map<string, { color: string; icon: string | null }>();
    schemas.forEach((schema, index) =>
      map.set(schema.id, {
        color: resolveSchemaColor(schema, index),
        icon: schema.icon ?? null
      })
    );
    return map;
  }, [schemas]);

  if (filtered.length === 0) {
    return (
      <div className={styles.list}>
        <EmptyState
          framed
          icon={<TbClipboardList size={20} />}
          title={emptyStateTitle[statusFilter]}
          subtitle="Assessments collect structured scores and notes on entities in this project."
          action={
            canEdit &&
            statusFilter !== 'archived' && (
              <Button variant="primary" icon={<TbPlus size={12} />} onClick={onCreate}>
                New assessment
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <AssessmentTable
      assessments={filtered}
      schemaColorMap={schemaColorMap}
      schemas={schemas}
      onOpen={onOpen}
    />
  );
};

type SortKey = 'name' | 'status';

const STATUS_ORDER: Record<Assessment['status'], number> = {
  draft: 0,
  open: 1,
  closed: 2,
  archived: 3
};

const COMPARATORS: Record<SortKey, (a: Assessment, b: Assessment) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
};

const AssessmentTable = ({
  assessments,
  schemaColorMap,
  schemas,
  onOpen
}: {
  assessments: Assessment[];
  schemaColorMap: Map<string, { color: string; icon: string | null }>;
  schemas: Pick<EntitySchema, 'id' | 'name'>[];
  onOpen: (assessmentId: string) => void;
}) => {
  const { sorted, sort, toggleSort } = useTableSort<Assessment, SortKey>(
    assessments,
    COMPARATORS,
    { key: 'name', dir: 'asc' }
  );

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
            Name
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="status" sort={sort} onSort={toggleSort}>
            Status
          </Table.SortableHeaderCell>
          <Table.HeaderCell>Scope</Table.HeaderCell>
          <Table.HeaderCell>Fields</Table.HeaderCell>
          <Table.HeaderCell>Progress</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.map(assessment => (
          <AssessmentRow
            key={assessment.id}
            assessment={assessment}
            schemaColorMap={schemaColorMap}
            schemas={schemas}
            onOpen={() => onOpen(assessment.id)}
          />
        ))}
      </Table.Body>
    </Table.Root>
  );
};

const AssessmentRow = ({
  assessment,
  schemaColorMap,
  schemas,
  onOpen
}: {
  assessment: Assessment;
  schemaColorMap: Map<string, { color: string; icon: string | null }>;
  schemas: Pick<EntitySchema, 'id' | 'name'>[];
  onOpen: () => void;
}) => {
  const showProgress = assessment.status === 'open' || assessment.status === 'closed';
  const badgeClass =
    assessment.status === 'draft'
      ? styles.statusDraft
      : assessment.status === 'open'
        ? styles.statusOpen
        : assessment.status === 'closed'
          ? styles.statusClosed
          : styles.statusArchived;
  const scopeSchemas = assessment.scope
    .map(id => schemas.find(schema => schema.id === id))
    .filter((schema): schema is { id: string; name: string } => !!schema);

  const { workspaceSlug } = useWorkspaceContext();
  const scopeQueries = useEntitiesBySchema(
    workspaceSlug,
    assessment.scope,
    assessment.scope_conditions
  );
  const inScopeCount = scopeQueries.reduce((sum, query) => sum + (query.data?.length ?? 0), 0);
  const pct =
    inScopeCount > 0 ? Math.round((assessment.completed_entity_count / inScopeCount) * 100) : 0;

  const cycleSuffix =
    assessment.recurrence.type !== 'none'
      ? ` (cycle ${assessment.current_occurrence}${
          assessment.next_occurrence_at
            ? ` · next reopens ${new Date(assessment.next_occurrence_at).toLocaleDateString()}`
            : ''
        })`
      : '';

  return (
    <Table.Row muted={assessment.status === 'archived'} onClick={onOpen}>
      <Table.NameCell
        icon={<TbClipboardList size={14} />}
        title={assessment.name + cycleSuffix}
        subtitle={assessment.description || undefined}
        titleMuted={assessment.status === 'archived'}
      />
      <Table.Cell>
        <span className={`${styles.status} ${badgeClass}`}>{STATUS_LABEL[assessment.status]}</span>
      </Table.Cell>
      <Table.Cell>
        <span className={styles.metaScope}>
          {scopeSchemas.map((schema, index) => {
            const meta = schemaColorMap.get(schema.id);
            return (
              <span key={schema.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {index > 0 && <span>·</span>}
                <TypeBadge color={meta?.color ?? '#888'} icon={meta?.icon} size={13} />
                {schema.name}
              </span>
            );
          })}
        </span>
      </Table.Cell>
      <Table.Cell>{assessment.fields.length}</Table.Cell>
      <Table.Cell>
        {showProgress && inScopeCount > 0 && (
          <div className={styles.completion}>
            <span className={styles.completionLabel}>
              {assessment.completed_entity_count} / {inScopeCount}
            </span>
            <div className={styles.completionBar}>
              <div className={styles.completionFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.completionPct}>{pct}%</span>
          </div>
        )}
      </Table.Cell>
    </Table.Row>
  );
};

export const PickedTeams = ({
  ids,
  labels,
  onRemove
}: {
  ids: string[];
  labels: Map<string, string>;
  onRemove: (id: string) => void;
}) => {
  if (ids.length === 0) return null;
  return (
    <div className={styles.pickedList}>
      {ids.map(id => (
        <span key={id} className={styles.pickedChip}>
          <span
            className={styles.teamDot}
            style={{ background: `oklch(0.65 0.15 ${stableHue(id)})` }}
          />
          {labels.get(id) ?? 'Unavailable team'}
          <button
            type="button"
            className={styles.pickedRemove}
            title="Remove team"
            onClick={() => onRemove(id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
};
