import { useMemo } from 'react';
import { TbClipboardList, TbDatabase, TbListCheck, TbPlus } from 'react-icons/tb';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../../components/TypeBadge';
import { EmptyState } from '../../../components/EmptyState';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { stableHue } from '../../../components/MemberAvatar';
import sharedStyles from '../ProjectDetailScreen.module.css';
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
  <div className={sharedStyles.entityTabNav}>
    {(
      [
        ['default', `Open / Closed (${counts.default})`],
        ['draft', `Draft (${counts.draft})`],
        ['archived', `Archived (${counts.archived})`],
        ['all', `All (${counts.all})`]
      ] as [StatusFilter, string][]
    ).map(([key, label]) => (
      <button
        key={key}
        type="button"
        className={`${sharedStyles.entityTabBtn} ${statusFilter === key ? sharedStyles.entityTabBtnActive : ''}`}
        onClick={() => onStatusFilterChange(key)}
      >
        {label}
      </button>
    ))}
  </div>
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
    <div className={styles.list}>
      {filtered.map(assessment => (
        <AssessmentCard
          key={assessment.id}
          assessment={assessment}
          schemaColorMap={schemaColorMap}
          schemas={schemas}
          onOpen={() => onOpen(assessment.id)}
        />
      ))}
    </div>
  );
};

export const AssessmentCard = ({
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
  const isArchived = assessment.status === 'archived';
  const isDraft = assessment.status === 'draft';
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

  return (
    <button
      type="button"
      className={`${styles.card} ${isArchived ? styles.cardArchived : ''} ${isDraft ? styles.cardDraft : ''}`}
      onClick={onOpen}
    >
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div className={styles.cardName}>{assessment.name}</div>
          <span className={`${styles.status} ${badgeClass}`}>
            {STATUS_LABEL[assessment.status]}
          </span>
        </div>
        {assessment.description && <div className={styles.cardDesc}>{assessment.description}</div>}
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            <TbListCheck size={11} />
            {assessment.fields.length} field{assessment.fields.length !== 1 ? 's' : ''}
          </span>
          {scopeSchemas.length > 0 && (
            <span className={styles.metaItem}>
              <TbDatabase size={11} />
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
            </span>
          )}
        </div>
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
        {assessment.recurrence.type !== 'none' && (
          <div className={styles.metaItem}>
            Cycle {assessment.current_occurrence}
            {assessment.next_occurrence_at &&
              ` · next reopens ${new Date(assessment.next_occurrence_at).toLocaleDateString()}`}
          </div>
        )}
      </div>
    </button>
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
