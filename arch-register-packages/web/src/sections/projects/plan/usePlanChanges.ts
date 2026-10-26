import { useMemo } from 'react';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectEntity } from '@arch-register/api-types/projectEntityContract';
import { useMilestones } from '../../../hooks/useMilestones';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import {
  flattenChangeCaseMembers,
  flattenRelationChangeCaseMembers,
  getProjectScenarioDate,
  toMilestonesById
} from '../../entities/components/snapshotDisplay';

/**
 * Everything the Plan tabs derive from a project's change cases: flattened entity and relation
 * members, milestone and relation lookups, the Project Diff target date, and the planned count.
 */
export const usePlanChanges = ({
  workspaceSlug,
  project,
  projectEntities,
  changeCases
}: {
  workspaceSlug: string;
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  changeCases: ChangeCase[];
}) => {
  // Entity and relation members are listed together; relations resolve names/schemas separately.
  const changeEntries = useMemo(
    () => [
      ...flattenChangeCaseMembers(changeCases),
      ...flattenRelationChangeCaseMembers(changeCases)
    ],
    [changeCases]
  );

  // Distinct planned change cases, not entity rows — a multi-entity case counts once.
  const plannedCount = useMemo(
    () =>
      new Set(
        changeEntries
          .filter(entry => entry.changeCase.status === 'planned')
          .map(entry => entry.changeCase.id)
      ).size,
    [changeEntries]
  );

  const { data: milestones = [] } = useMilestones(workspaceSlug, project.id);
  const milestonesById = useMemo(() => toMilestonesById(milestones), [milestones]);

  // Project Diff target date — the latest effective date across this project's planned changes,
  // falling back to the project's own end date when no planned change is dated.
  const diffTargetDate = useMemo(
    () => getProjectScenarioDate(project.target_date, changeCases, milestonesById),
    [changeCases, milestonesById, project.target_date]
  );

  const hasRelationMembers = changeEntries.some(entry => entry.member.kind === 'relation');
  const { data: relations = [] } = useRelations(workspaceSlug, {}, { enabled: hasRelationMembers });
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceSlug, hasRelationMembers);
  const relationNameById = useMemo(
    () => new Map(relations.map(r => [r._uid, `${r._in.name} → ${r._out.name}`])),
    [relations]
  );
  const relationSchemaById = useMemo(
    () => new Map(relationSchemas.map(schema => [schema.id, schema])),
    [relationSchemas]
  );
  const relationSchemaIdByRelationId = useMemo(
    () => new Map(relations.map(r => [r._uid, r._schema.id])),
    [relations]
  );
  const entityNameById = useMemo(
    () =>
      new Map([
        ...projectEntities.map(e => [e.entity_id, e.entity_name] as const),
        ...relationNameById
      ]),
    [projectEntities, relationNameById]
  );

  return {
    changeEntries,
    plannedCount,
    milestonesById,
    diffTargetDate,
    relationNameById,
    relationSchemaById,
    relationSchemaIdByRelationId,
    entityNameById
  };
};
