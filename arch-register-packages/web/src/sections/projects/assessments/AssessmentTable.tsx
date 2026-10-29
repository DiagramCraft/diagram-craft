import { useMemo } from 'react';
import { ProgressBar } from '../../../components/ProgressBar';
import {
  ASSESSMENT_STATUS_LABEL,
  matchesAssessmentListFilter,
  type AssessmentListFilter
} from '../../../lib/assessmentStatus';
import { TbClipboardList, TbPlus } from 'react-icons/tb';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../../components/TypeBadge';
import { EmptyState } from '../../../components/EmptyState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import styles from './AssessmentTable.module.css';

const emptyStateTitle: Record<AssessmentListFilter, string> = {
  default: 'No open or closed assessments',
  draft: 'No draft assessments',
  archived: 'No archived assessments',
  all: 'No assessments yet'
};

export const AssessmentTable = ({
  assessments,
  statusFilter,
  schemas,
  canEdit,
  onCreate,
  onOpen
}: {
  assessments: Assessment[];
  statusFilter: AssessmentListFilter;
  schemas: EntitySchema[];
  canEdit: boolean;
  onCreate: () => void;
  onOpen: (assessmentId: string) => void;
}) => {
  const filtered = assessments.filter(assessment =>
    matchesAssessmentListFilter(assessment, statusFilter)
  );

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
    <AssessmentRowsTable
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

const AssessmentRowsTable = ({
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
  const { sorted, sort, toggleSort } = useTableSort<Assessment, SortKey>(assessments, COMPARATORS, {
    key: 'name',
    dir: 'asc'
  });

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
        <span className={`${styles.status} ${badgeClass}`}>
          {ASSESSMENT_STATUS_LABEL[assessment.status]}
        </span>
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
            <ProgressBar
              className={styles.completionBar}
              height={3}
              percent={pct}
              fillColor="var(--green)"
            />
            <span className={styles.completionPct}>{pct}%</span>
          </div>
        )}
      </Table.Cell>
    </Table.Row>
  );
};
