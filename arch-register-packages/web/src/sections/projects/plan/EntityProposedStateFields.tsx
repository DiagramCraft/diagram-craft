import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { EntityFormFields } from '../../../components/EntityFormFields';
import type { EntityEditState } from '../../../lib/entityEditState';

type Props = {
  workspaceId: string;
  schema: EntitySchema | null;
  planState: EntityEditState;
  setPlanState: (updater: (state: EntityEditState) => EntityEditState) => void;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
};

// Relations are planned as separate members of a change case, so reference and containment
// fields are intentionally not offered here.
export const EntityProposedStateFields = ({
  workspaceId,
  schema,
  planState,
  setPlanState,
  teams,
  lifecycleStates
}: Props) => (
  <EntityFormFields
    workspaceId={workspaceId}
    schema={schema}
    state={planState}
    setState={setPlanState}
    teams={teams}
    lifecycleStates={lifecycleStates}
  />
);
