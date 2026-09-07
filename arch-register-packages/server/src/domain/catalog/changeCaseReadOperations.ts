import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import { requireEntityAction, requireProjectAccess } from '../auth/authorization';
import {
  filterKnownRestrictedFieldGroups,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import { getEntitySchemaAt, getRelationSchemaAt } from './schemaHistory';
import type { ChangeCaseDbResult, ChangeCaseMemberDbResult } from './db/changeCaseDatabase';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import { getProjectOrThrow, getCaseOrThrow } from './changeCaseContext';
import { getRelationOwnerSchemas } from './relationHelpers';
import { canViewTypedRelation } from './relationAccessControl';

const redactMemberStateData = (
  state: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  schema: FieldGroupSchemaShape | null
): Record<string, unknown> => {
  const data = state['data'];
  if (data == null || typeof data !== 'object') return state;
  return {
    ...state,
    data: filterKnownRestrictedFieldGroups(authCtx, schema, data as Record<string, unknown>)
  };
};

/** A member's state carries `in_entity_id`/`out_entity_id` only when it belongs to a relation. */
const memberStateEndpoints = (member: ChangeCaseMemberDbResult) => {
  const state =
    member.base_state['in_entity_id'] != null ? member.base_state : member.proposed_state;
  const inEntityId = state['in_entity_id'];
  const outEntityId = state['out_entity_id'];
  return typeof inEntityId === 'string' && typeof outEntityId === 'string'
    ? {
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        schema_id: String(state['schema_id'] ?? '')
      }
    : null;
};

/**
 * A change case can be visible through project access while one of its relation members is still
 * endpoint-restricted. Apply the same endpoint gate used by direct relation reads.
 */
const resolveRelationMemberVisibility = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: AuthorizationContext | null,
  members: ChangeCaseMemberDbResult[]
): Promise<Map<string, boolean>> => {
  const visibility = new Map<string, boolean>();
  await Promise.all(
    members.map(async member => {
      const endpoints = memberStateEndpoints(member);
      if (!endpoints) return;
      const { inSchema, outSchema } = await getRelationOwnerSchemas(db, ws, endpoints);
      visibility.set(
        member.id,
        canViewTypedRelation(
          authCtx,
          [
            { schema: inSchema, direction: 'in' },
            { schema: outSchema, direction: 'out' }
          ],
          endpoints.schema_id
        )
      );
    })
  );
  return visibility;
};

export const toApiChangeCase = async (
  db: DatabaseAdapter,
  ws: string,
  changeCase: ChangeCaseDbResult,
  authCtx: AuthorizationContext | null
): Promise<ChangeCase> => {
  const revision = await db.changeCase.getLatestRevision(ws, changeCase.id);
  const members = revision ? await db.changeCase.listMembers(ws, revision.id) : [];
  const schemaIds = new Set(
    members
      .flatMap(member => [member.base_state, member.proposed_state])
      .map(state => String(state['schema_id'] ?? ''))
      .filter(Boolean)
  );
  const asOf = revision?.created_at ?? changeCase.updated_at;
  const [schemas, relationMemberVisibility] = await Promise.all([
    Promise.all(
      [...schemaIds].map(
        async schemaId =>
          (await getEntitySchemaAt(db, ws, schemaId, asOf)) ??
          (await getRelationSchemaAt(db, ws, schemaId, asOf))
      )
    ),
    resolveRelationMemberVisibility(db, ws, authCtx, members)
  ]);
  const schemaById = new Map(
    [...schemaIds]
      .map((schemaId, index) => [schemaId, schemas[index]] as const)
      .filter((entry): entry is [string, FieldGroupSchemaShape] => entry[1] != null)
  );
  return {
    id: changeCase.id,
    workspace: changeCase.workspace,
    project_id: changeCase.project_id,
    status: changeCase.status,
    name: changeCase.name,
    description: changeCase.description,
    target_date: changeCase.effective_date,
    milestone_id: changeCase.milestone_id,
    commit_message: revision?.message ?? null,
    created_at: changeCase.created_at.toISOString(),
    updated_at: changeCase.updated_at.toISOString(),
    members: members.map(member =>
      toApiMember(member, authCtx, schemaById, relationMemberVisibility.get(member.id) ?? true)
    )
  };
};

export const toApiMember = (
  member: ChangeCaseMemberDbResult,
  authCtx: AuthorizationContext | null,
  schemaById: Map<string, FieldGroupSchemaShape>,
  endpointVisible = true
) => {
  const baseState = member.base_state;
  const proposedState = member.proposed_state;
  if (!endpointVisible) {
    return {
      id: member.id,
      entity_id: member.entity_id,
      base_version: member.base_version,
      base_state: { ...baseState, data: {} },
      proposed_state: { ...proposedState, data: {} },
      applied_version_id: member.applied_version_id
    };
  }
  const baseSchema = schemaById.get(String(baseState['schema_id'] ?? '')) ?? null;
  const proposedSchema = schemaById.get(String(proposedState['schema_id'] ?? '')) ?? baseSchema;
  return {
    id: member.id,
    entity_id: member.entity_id,
    base_version: member.base_version,
    base_state: redactMemberStateData(baseState, authCtx, baseSchema),
    proposed_state: redactMemberStateData(proposedState, authCtx, proposedSchema),
    applied_version_id: member.applied_version_id
  };
};

export const listChangeCasesByProject = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to retrieve change cases',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const rows = await db.changeCase.listCasesByProject(ws, project.id);
      return Promise.all(rows.map(row => toApiChangeCase(db, ws, row, authCtx)));
    }
  });
};

export const listChangeCasesByEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase[]> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to retrieve change cases',
    operation: async ({ ws, authCtx }) => {
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Data record '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );

      const rows = await db.changeCase.listCasesByEntity(ws, entity.id);
      return Promise.all(rows.map(row => toApiChangeCase(db, ws, row, authCtx)));
    }
  });
};

export const getChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to retrieve change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};
