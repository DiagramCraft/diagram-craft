import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useGovernanceCases } from '../../../hooks/useGovernance';
import { useWorkspaceMembers } from '../../../hooks/useWorkspaceMembers';
import { entityDetailQuery } from '../../../queries/entities';
import { deriveDueDatePriority, type NeedsAttentionPriority } from './needsAttentionQueue';

export type EntityCaseRegisterRow = {
  case: GovernanceCase;
  entity: EntityRecord;
  requesterName: string | null;
  /** Derived, not a real field on `GovernanceCase` — see `deriveDueDatePriority`. */
  risk: NeedsAttentionPriority;
};

/**
 * A workspace-wide register of governance cases of the given kinds against entities of one
 * schema, in every status — as opposed to `useNeedsAttentionQueue`, which only surfaces open (or
 * assigned) cases. Each case's `subjectId` (the entity id for entity-subject case kinds) is joined
 * against its entity detail; cases whose entity is of another schema are dropped. Generalized from
 * Data Stewardship's former change-case register (#3301).
 */
export const useEntityCaseRegister = (
  workspaceSlug: string,
  { schemaId, caseKinds }: { schemaId: string | null; caseKinds: readonly string[] },
  enabled = true
): { rows: EntityCaseRegisterRow[]; isLoading: boolean; isError: boolean } => {
  const active = enabled && schemaId != null && caseKinds.length > 0;
  const cases = useGovernanceCases(workspaceSlug, { subjectType: 'entity' }, active);
  const members = useWorkspaceMembers(workspaceSlug);

  const relevantCases = useMemo(
    () =>
      (cases.data ?? []).filter(
        governanceCase =>
          governanceCase.subjectType === 'entity' && caseKinds.includes(governanceCase.caseKind)
      ),
    [cases.data, caseKinds]
  );

  const entityIds = useMemo(
    () => [...new Set(relevantCases.map(governanceCase => governanceCase.subjectId))],
    [relevantCases]
  );
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspaceSlug, entityId))
  });
  const entityById = useMemo(
    () => new Map(entityIds.map((id, index) => [id, entityQueries[index]?.data])),
    [entityIds, entityQueries]
  );

  const memberNameById = useMemo(
    () => new Map((members.data ?? []).map(member => [member.user_id, member.display_name])),
    [members.data]
  );

  const rows = useMemo(
    () =>
      relevantCases
        .map((governanceCase): EntityCaseRegisterRow | null => {
          const entity = entityById.get(governanceCase.subjectId);
          if (entity == null || entity._schema?.id !== schemaId) return null;
          return {
            case: governanceCase,
            entity,
            requesterName: governanceCase.initiatorUserId
              ? (memberNameById.get(governanceCase.initiatorUserId) ??
                governanceCase.initiatorUserId)
              : null,
            risk: deriveDueDatePriority(governanceCase)
          };
        })
        .filter((row): row is EntityCaseRegisterRow => row != null),
    [relevantCases, entityById, schemaId, memberNameById]
  );

  return {
    rows,
    isLoading: active && (cases.isLoading || members.isLoading),
    isError: cases.isError
  };
};
