import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { Chip } from '../../../components/Chip';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { useWorkspaceCapabilityConfigurations } from '../../../hooks/useWorkspaceConfig';
import { entityTypedRelationsQuery } from '../../../queries/relations';
import {
  combineAffectedObjectives,
  existingEntityMemberIds,
  extractAffectedObjectives,
  resolveAffectedObjectiveConfig,
  type AffectedObjective,
  type AffectedObjectivesState
} from './affectedObjectives';
import styles from './PlanChangeDialog.module.css';

type UseAffectedObjectivesProps = {
  workspaceId: string;
  memberKeys: readonly string[];
  relationSchemas: readonly RelationSchema[];
  enabled: boolean;
};

export const useAffectedObjectives = ({
  workspaceId,
  memberKeys,
  relationSchemas,
  enabled
}: UseAffectedObjectivesProps): AffectedObjectivesState => {
  const capabilityQuery = useWorkspaceCapabilityConfigurations(workspaceId, enabled);
  const config = useMemo(
    () => resolveAffectedObjectiveConfig(relationSchemas, capabilityQuery.data),
    [capabilityQuery.data, relationSchemas]
  );
  const entityIds = useMemo(() => existingEntityMemberIds(memberKeys), [memberKeys]);
  const relationQueries = useQueries({
    queries:
      !enabled || capabilityQuery.isError || config === null
        ? []
        : entityIds.map(entityId => entityTypedRelationsQuery(workspaceId, entityId))
  });
  const byMember = useMemo(
    () =>
      new Map(
        entityIds.map((entityId, index) => [
          entityId,
          extractAffectedObjectives(relationQueries[index]?.data?.incoming ?? [], config)
        ])
      ),
    [config, entityIds, relationQueries]
  );

  if (!enabled || capabilityQuery.isError || (!capabilityQuery.isLoading && config === null)) {
    return { status: 'hidden', byMember, objectives: [] };
  }
  if (capabilityQuery.isLoading || relationQueries.some(query => query.isLoading)) {
    return { status: 'loading', byMember, objectives: [] };
  }
  if (relationQueries.some(query => query.isError)) {
    return { status: 'error', byMember, objectives: [] };
  }
  return {
    status: 'ready',
    byMember,
    objectives: combineAffectedObjectives(byMember)
  };
};

const ObjectiveLinks = ({ objectives }: { objectives: readonly AffectedObjective[] }) => (
  <div className={styles.affectedObjectivesList}>
    {objectives.map(objective => (
      <Chip key={objective.id} tone="ghost">
        <EntityNavigationLink publicId={objective.id} className={styles.affectedObjectiveLink}>
          {objective.name}
        </EntityNavigationLink>
      </Chip>
    ))}
  </div>
);

export const AffectedObjectivesSummary = ({ state }: { state: AffectedObjectivesState }) => {
  if (state.status === 'hidden') return null;

  return (
    <div className={styles.affectedObjectives}>
      <div className={styles.label}>Affected objectives</div>
      <div className={styles.affectedObjectivesHint}>
        Derived from the selected entities&apos; current relationships.
      </div>
      {state.status === 'loading' ? (
        <div className={styles.affectedObjectivesEmpty}>Loading objectives...</div>
      ) : state.status === 'error' ? (
        <div className={styles.affectedObjectivesEmpty}>Affected objectives unavailable.</div>
      ) : state.objectives.length > 0 ? (
        <ObjectiveLinks objectives={state.objectives} />
      ) : (
        <div className={styles.affectedObjectivesEmpty}>
          No affected objectives for the selected entities.
        </div>
      )}
    </div>
  );
};

export const AffectedObjectivesMemberLine = ({
  state,
  memberKey,
  isDraft
}: {
  state: AffectedObjectivesState;
  memberKey: string;
  isDraft: boolean;
}) => {
  if (state.status === 'hidden') return null;
  if (state.status === 'loading') {
    return <div className={styles.entityPaneRowObjectives}>Loading objectives...</div>;
  }
  if (state.status === 'error') {
    return <div className={styles.entityPaneRowObjectives}>Objectives unavailable</div>;
  }
  if (isDraft) {
    return <div className={styles.entityPaneRowObjectives}>No current objective links</div>;
  }

  const objectives = state.byMember.get(memberKey) ?? [];
  return (
    <div className={styles.entityPaneRowObjectives}>
      {objectives.length > 0
        ? `Affected by: ${objectives.map(objective => objective.name).join(', ')}`
        : 'No affected objectives'}
    </div>
  );
};
