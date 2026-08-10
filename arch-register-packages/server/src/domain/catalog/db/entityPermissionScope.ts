import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

export type EntityViewPermissionScope = {
  userId: string;
  teamIds: readonly string[];
  workspaceWide: boolean;
  scopedViewAllowed: boolean;
};

export type EntityPermissionScopeDialect = 'postgres' | 'sqlite';

type AddParam = (value: unknown) => string;

const checker = new PermissionChecker();

/**
 * Extract the small, request-local part of authorization needed by a bulk entity-view query.
 * Entity rows, schemas, and grants stay in the database; the pure checker remains responsible
 * for point decisions and is used as the oracle by contract tests.
 */
export const buildEntityViewPermissionScope = (
  context: WorkspaceAuthorizationContext | null
): EntityViewPermissionScope | null => {
  if (context == null) return null;

  const ceiling = context.workspaceCapabilityCeiling;
  const scopedViewAllowed =
    ceiling == null ||
    ceiling.has('content.view') ||
    ceiling.has('ent.edit') ||
    ceiling.has('ent.propose');

  return {
    userId: context.userId,
    teamIds: [
      ...(context.teamIds ??
        (context.teamRolesByTeam != null ? [...context.teamRolesByTeam.keys()] : []))
    ],
    workspaceWide: checker.hasWorkspaceWideEntityView(context),
    scopedViewAllowed
  };
};

const postgresAncestorCte = (
  baseWorkspaceParam: string,
  recursiveWorkspaceParam: string
): string => `
  permission_ancestors (descendant_id, ancestor_id) AS (
    SELECT child.id, parent.id
    FROM catalog_record child
    JOIN entity_schema child_schema
      ON child_schema.workspace = child.workspace
     AND child_schema.id = child.schema_id
    CROSS JOIN LATERAL jsonb_array_elements(child_schema.fields) AS schema_field
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(child.data -> (schema_field.value ->> 'id'))
        WHEN 'array' THEN child.data -> (schema_field.value ->> 'id')
        WHEN 'string' THEN jsonb_build_array(child.data -> (schema_field.value ->> 'id'))
        ELSE '[]'::jsonb
      END
    ) AS parent_ref
    JOIN catalog_record parent
      ON parent.workspace = child.workspace
     AND parent.id::text = parent_ref.value
     AND parent.kind = 'entity'
     AND parent.deleted_at IS NULL
    WHERE child.workspace = ${baseWorkspaceParam}
      AND child.kind = 'entity'
      AND child.deleted_at IS NULL
      AND schema_field.value ->> 'type' = 'containment'

    UNION

    SELECT ancestors.descendant_id, parent.id
    FROM permission_ancestors ancestors
    JOIN catalog_record child
      ON child.workspace = ${recursiveWorkspaceParam}
     AND child.id = ancestors.ancestor_id
     AND child.kind = 'entity'
     AND child.deleted_at IS NULL
    JOIN entity_schema child_schema
      ON child_schema.workspace = child.workspace
     AND child_schema.id = child.schema_id
    CROSS JOIN LATERAL jsonb_array_elements(child_schema.fields) AS schema_field
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(child.data -> (schema_field.value ->> 'id'))
        WHEN 'array' THEN child.data -> (schema_field.value ->> 'id')
        WHEN 'string' THEN jsonb_build_array(child.data -> (schema_field.value ->> 'id'))
        ELSE '[]'::jsonb
      END
    ) AS parent_ref
    JOIN catalog_record parent
      ON parent.workspace = child.workspace
     AND parent.id::text = parent_ref.value
     AND parent.kind = 'entity'
     AND parent.deleted_at IS NULL
    WHERE schema_field.value ->> 'type' = 'containment'
  )`;

const sqliteAncestorCte = (baseWorkspaceParam: string, recursiveWorkspaceParam: string): string => `
  permission_ancestors (descendant_id, ancestor_id) AS (
    SELECT child.id, parent.id
    FROM catalog_record child
    JOIN entity_schema child_schema
      ON child_schema.workspace = child.workspace
     AND child_schema.id = child.schema_id
    JOIN json_each(child_schema.fields) schema_field
    JOIN json_each(child.data) data_field
      ON data_field.key = json_extract(schema_field.value, '$.id')
    JOIN json_each(
      CASE
        WHEN data_field.type = 'array' THEN data_field.value
        ELSE json_array(data_field.value)
      END
    ) parent_ref
    JOIN catalog_record parent
      ON parent.workspace = child.workspace
     AND parent.id = parent_ref.value
     AND parent.kind = 'entity'
     AND parent.deleted_at IS NULL
    WHERE child.workspace = ${baseWorkspaceParam}
      AND child.kind = 'entity'
      AND child.deleted_at IS NULL
      AND json_extract(schema_field.value, '$.type') = 'containment'

    UNION

    SELECT ancestors.descendant_id, parent.id
    FROM permission_ancestors ancestors
    JOIN catalog_record child
      ON child.workspace = ${recursiveWorkspaceParam}
     AND child.id = ancestors.ancestor_id
     AND child.kind = 'entity'
     AND child.deleted_at IS NULL
    JOIN entity_schema child_schema
      ON child_schema.workspace = child.workspace
     AND child_schema.id = child.schema_id
    JOIN json_each(child_schema.fields) schema_field
    JOIN json_each(child.data) data_field
      ON data_field.key = json_extract(schema_field.value, '$.id')
    JOIN json_each(
      CASE
        WHEN data_field.type = 'array' THEN data_field.value
        ELSE json_array(data_field.value)
      END
    ) parent_ref
    JOIN catalog_record parent
      ON parent.workspace = child.workspace
     AND parent.id = parent_ref.value
     AND parent.kind = 'entity'
     AND parent.deleted_at IS NULL
    WHERE json_extract(schema_field.value, '$.type') = 'containment'
  )`;

/**
 * Compile the view predicate used by both legacy list queries and structured EntityQuery CTEs.
 * The returned CTE is intentionally separate so callers can place it before their own scope CTE.
 */
export const compileEntityViewPermissionScope = (
  workspace: string,
  scope: EntityViewPermissionScope | null,
  dialect: EntityPermissionScopeDialect,
  addParam: AddParam,
  entityAlias = 'e'
): { cte: string | null; predicate: string } => {
  if (scope == null || scope.workspaceWide) return { cte: null, predicate: '1=1' };
  if (!scope.scopedViewAllowed) return { cte: null, predicate: '1=0' };

  const baseWorkspaceParam = addParam(workspace);
  const recursiveWorkspaceParam = addParam(workspace);
  const teamList = () => {
    const teamParams = scope.teamIds.map(teamId => addParam(teamId));
    return teamParams.length > 0 ? teamParams.join(', ') : null;
  };
  const ownerTeamList = teamList();
  const ancestorOwnerTeamList = teamList();
  const userParam = addParam(scope.userId);
  const grantTeamList = teamList();
  const ownerClause = ownerTeamList == null ? '1=0' : `${entityAlias}.owner IN (${ownerTeamList})`;
  const ancestorOwnerClause =
    ancestorOwnerTeamList == null
      ? '1=0'
      : `EXISTS (
          SELECT 1
          FROM permission_ancestors visible_ancestor
          JOIN catalog_record ancestor
            ON ancestor.workspace = ${entityAlias}.workspace
           AND ancestor.id = visible_ancestor.ancestor_id
           AND ancestor.kind = 'entity'
           AND ancestor.deleted_at IS NULL
          WHERE visible_ancestor.descendant_id = ${entityAlias}.id
            AND ancestor.owner IN (${ancestorOwnerTeamList})
        )`;
  const principalClause =
    grantTeamList == null
      ? `(grant_row.principal_type = 'user' AND grant_row.principal_id = ${userParam})`
      : `(
          (grant_row.principal_type = 'user' AND grant_row.principal_id = ${userParam})
          OR (grant_row.principal_type = 'team' AND grant_row.principal_id IN (${grantTeamList}))
        )`;
  const grantClause = `EXISTS (
    SELECT 1
    FROM entity_grant grant_row
    WHERE grant_row.workspace = ${entityAlias}.workspace
      AND ${principalClause}
      AND (
        grant_row.entity_id = ${entityAlias}.id
        OR (
          grant_row.applies_to = 'subtree'
          AND EXISTS (
            SELECT 1
            FROM permission_ancestors granted_ancestor
            WHERE granted_ancestor.descendant_id = ${entityAlias}.id
              AND granted_ancestor.ancestor_id = grant_row.entity_id
          )
        )
      )
  )`;

  return {
    cte:
      dialect === 'postgres'
        ? postgresAncestorCte(baseWorkspaceParam, recursiveWorkspaceParam)
        : sqliteAncestorCte(baseWorkspaceParam, recursiveWorkspaceParam),
    predicate: `(${ownerClause} OR ${ancestorOwnerClause} OR ${grantClause})`
  };
};
