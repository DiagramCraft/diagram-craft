import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { useMemo } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { formatDate } from '../../../utils/dateFormat';
import { useEntityLandscapeDiff } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { EntityLandscapeDiffTable } from './EntityLandscapeDiffTable';
import { RelationLandscapeDiffTable } from './RelationLandscapeDiffTable';
import styles from './EntityDiffView.module.css';

export const EntityDiffView = ({
  workspaceId,
  projectId,
  projectScope,
  collectionId,
  q,
  conditions,
  entityQuery,
  targetDate,
  includePlannedChanges,
  includeOverdueChanges,
  schemas,
  lifecycleStates,
  teams
}: {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  collectionId?: string | null;
  q: string;
  conditions: FilterCondition[];
  entityQuery?: EntityQuery | null;
  targetDate?: string;
  includePlannedChanges: boolean;
  includeOverdueChanges: boolean;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
}) => {
  const schemaMap = useMemo(
    () =>
      new Map(
        schemas.map(schema => [schema.id, { color: schema.color ?? '#888', icon: schema.icon }])
      ),
    [schemas]
  );
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId, true);
  const relationSchemaMap = useMemo(
    () =>
      new Map(
        relationSchemas.map(schema => [
          schema.id,
          { color: schema.color ?? '#888', icon: schema.icon }
        ])
      ),
    [relationSchemas]
  );
  const filters = useMemo(
    () => ({
      q: q || undefined,
      conditions: conditions.length > 0 ? conditions : undefined,
      projectId,
      projectScope: projectId ? projectScope : undefined,
      collectionId: collectionId ?? undefined
    }),
    [q, conditions, projectId, projectScope, collectionId]
  );

  const states = useMemo(() => {
    if (!targetDate) return null;
    return {
      from: {
        asOf: new Date().toISOString(),
        includePlannedChanges: false,
        includeOverdueChanges: false,
        ...filters
      },
      to: { asOf: targetDate, includePlannedChanges, includeOverdueChanges, ...filters }
    };
  }, [targetDate, includePlannedChanges, includeOverdueChanges, filters]);

  const { data: diff, isLoading } = useEntityLandscapeDiff(
    workspaceId,
    states?.from ?? null,
    states?.to ?? null
  );

  if (entityQuery) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Diff view doesn't support the advanced query editor"
          subtitle="Clear the structured query to compare entities against a future date."
        />
      </div>
    );
  }

  if (!targetDate) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Pick a date to compare against"
          subtitle="Use the date picker above to see what changes between now and a chosen date, including all planned changes across projects."
        />
      </div>
    );
  }

  if (isLoading || !diff) {
    return <div className={styles.wrap}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>What changes by {formatDate(targetDate)}</div>
        <div className={styles.headerCounts}>
          {diff.added.length} added &middot; {diff.removed.length} removed &middot;{' '}
          {diff.changed.length} changed
          {(diff.relations.added.length > 0 ||
            diff.relations.removed.length > 0 ||
            diff.relations.changed.length > 0) && (
            <>
              {' '}
              &middot; {diff.relations.added.length} relations added &middot;{' '}
              {diff.relations.removed.length} relations removed &middot;{' '}
              {diff.relations.changed.length} relations changed
            </>
          )}
        </div>
      </div>

      <EntityLandscapeDiffTable
        diff={diff}
        schemaMap={schemaMap}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />

      <RelationLandscapeDiffTable
        diff={diff.relations}
        relationSchemaMap={relationSchemaMap}
        relationSchemas={relationSchemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
    </div>
  );
};
