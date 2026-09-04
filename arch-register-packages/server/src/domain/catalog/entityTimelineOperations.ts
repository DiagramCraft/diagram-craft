import type { TimelineViewData } from '@arch-register/api-types/entityContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { EntityVersionSummaryDbResult } from './db/catalogDatabase';
import { runAuthorizedOperation } from '../operation';
import { PermissionChecker } from '@arch-register/permissions';
import { canAccessProject } from '../auth/authorization';

const checker = new PermissionChecker();

const serializeTimelineVersion = (version: EntityVersionSummaryDbResult) => ({
  ...version,
  created_at: version.created_at.toISOString(),
  created_by_name: version.created_by_name
});

export const getTimelineViewData = async (
  db: DatabaseAdapter,
  workspace: string,
  ids: string[],
  event: AuthenticatedEvent
): Promise<Record<string, TimelineViewData>> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to retrieve timeline view data',
    operation: async ({ ws, authCtx }) => {
      const requestedIds = [...new Set(ids)];
      if (requestedIds.length === 0) return {};

      const entities = await db.catalog.listEntities(ws);
      const visibleIds = new Set(
        entities
          .filter(
            entity => authCtx == null || checker.hasEntityPermission(authCtx, entity, 'view_entity')
          )
          .map(entity => entity.id)
      );
      const entityIds = requestedIds.filter(id => visibleIds.has(id));
      if (entityIds.length === 0) return {};

      const [versions, changes, projects] = await Promise.all([
        db.catalog.listEntityVersionsByIds(ws, entityIds),
        db.changeCase.listTimelineMembersByEntities(ws, entityIds),
        db.project.projects.listProjects(ws)
      ]);
      const visibleProjectIds = new Set(
        projects
          .filter(project => authCtx == null || canAccessProject(authCtx, project.owner))
          .map(project => project.id)
      );

      const result: Record<string, TimelineViewData> = {};
      for (const entityId of entityIds) {
        result[entityId] = { versions: [], projectChanges: [] };
      }

      for (const version of versions) {
        result[version.record_id]?.versions.push(serializeTimelineVersion(version));
      }

      for (const change of changes) {
        if (
          change.changeCase.project_id != null &&
          !visibleProjectIds.has(change.changeCase.project_id)
        ) {
          continue;
        }
        const data = result[change.member.entity_id];
        if (!data) continue;
        data.projectChanges.push({
          changeCase: {
            id: change.changeCase.id,
            workspace: change.changeCase.workspace,
            project_id: change.changeCase.project_id,
            status: change.changeCase.status,
            name: change.changeCase.name,
            description: change.changeCase.description,
            target_date: change.changeCase.effective_date,
            milestone_id: change.changeCase.milestone_id,
            commit_message: change.revisionMessage,
            created_at: change.changeCase.created_at.toISOString(),
            updated_at: change.changeCase.updated_at.toISOString()
          },
          member: {
            id: change.member.id,
            entity_id: change.member.entity_id,
            base_version: change.member.base_version,
            applied_version_id: change.member.applied_version_id
          }
        });
      }

      return result;
    }
  });
