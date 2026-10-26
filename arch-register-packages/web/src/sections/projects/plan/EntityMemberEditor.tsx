import { useEffect, useState } from 'react';
import { useEntity } from '../../../hooks/useEntities';
import { createEntityEditState, type EntityEditState } from '../../../lib/entityEditState';
import { buildProposedState } from '../../../lib/entityProposedStateBuilder';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { LoadingState } from '../../../components/LoadingState';
import { EntityProposedStateFields } from './EntityProposedStateFields';
import { computeChangedLabels } from './planChangeDraft';
import sharedStyles from './plan-change-dialog-shared.module.css';

type Props = {
  workspaceId: string;
  projectId: string;
  memberKey: string;
  // Id of an existing entity; ignored when `draftEntity` is set
  entityId: string;
  draftEntity?: EntityRecord;
  isActive: boolean;
  schemas: EntitySchema[];
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  existingProposedState?: Record<string, unknown> | null;
  onProposedStateChange: (memberKey: string, proposedState: Record<string, unknown>) => void;
  onChangedLabelsChange: (memberKey: string, labels: string[]) => void;
};

// Edits the planned state of one entity member of a change case.
export const EntityMemberEditor = ({
  workspaceId,
  projectId,
  memberKey,
  entityId,
  draftEntity,
  isActive,
  schemas,
  teams,
  lifecycleStates,
  existingProposedState,
  onProposedStateChange,
  onChangedLabelsChange
}: Props) => {
  const { data: loadedEntity } = useEntity(workspaceId, draftEntity ? '' : entityId);
  const entity = draftEntity ?? loadedEntity;
  const schema = entity ? (schemas.find(s => s.id === entity._schema.id) ?? null) : null;
  const [planState, setPlanState] = useState<EntityEditState | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: existingProposedState is only read once, on initial load
  useEffect(() => {
    if (!entity || !schema || planState !== null) return;
    const state = createEntityEditState(entity, schema);
    if (existingProposedState) {
      const proposedData =
        (existingProposedState['data'] as Record<string, unknown> | undefined) ?? {};
      state._name = existingProposedState['name'] ?? state._name;
      state._description = existingProposedState['description'] ?? state._description;
      state._owner = existingProposedState['owner'] ?? '';
      state._lifecycle = existingProposedState['lifecycle'] ?? '';
      state._targetLifecycle = existingProposedState['target_lifecycle'] ?? '';
      state._targetLifecycleDate = existingProposedState['target_lifecycle_date'] ?? '';
      for (const field of schema.fields) {
        state[field.id] = proposedData[field.id] ?? state[field.id];
      }
    }
    setPlanState(state);
  }, [entity, schema, planState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onProposedStateChange/onChangedLabelsChange are fresh callbacks each render; including them would create a render loop
  useEffect(() => {
    if (!entity || !schema || !planState) return;
    const proposedState = buildProposedState(entity, schema, planState, existingProposedState);
    if (entity._projectId === projectId) proposedState.project_id = null;
    onProposedStateChange(memberKey, proposedState);
    onChangedLabelsChange(memberKey, computeChangedLabels(entity, schema, planState));
  }, [entity, schema, planState, memberKey, projectId]);

  return (
    <div style={{ display: isActive ? undefined : 'none' }}>
      {!entity || !schema || !planState ? (
        <LoadingState text="Loading..." size="sm" />
      ) : (
        <div className={sharedStyles.editorPaneContent}>
          <EntityProposedStateFields
            workspaceId={workspaceId}
            schema={schema}
            planState={planState}
            setPlanState={updater => setPlanState(prev => (prev ? updater(prev) : prev))}
            teams={teams}
            lifecycleStates={lifecycleStates}
          />
        </div>
      )}
    </div>
  );
};
