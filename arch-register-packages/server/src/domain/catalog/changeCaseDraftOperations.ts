import { randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { runAuthorizedOperation } from '../operation';
import { requireEntityAction, requireProjectAction } from '../auth/authorization';
import { allocateEntityPublicId } from './entityMutationOperations';
import { createEntityWithAudit } from './entityMutations';
import type { Entity, EntityDbCreate } from './db/catalogDatabase';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields,
  resolveCreateOwner
} from './dataHelpers';
import { normalizeEntityScalarFields } from './entityScalarValues';
import { getWorkspaceEnumDefinitions } from './enumOptions';
import { listAllCatalogEntities } from './entityLoader';
import { computeEntityCompleteness } from '../../utils/completeness';
import type {
  ChangeCase,
  CreateChangeCaseRequest,
  SaveChangeCaseDraftRequest
} from '@arch-register/api-types/changeCaseContract';
import {
  asRecord,
  assertEntityBelongsToProject,
  buildMemberInput,
  getActiveRevisionOrThrow,
  getCaseOrThrow,
  getProjectOrThrow,
  requireCaseEditAccess,
  resolveEffectiveDate
} from './changeCaseContext';
import { requireNoRestrictedCaseMemberWrites } from './changeCaseMutationAuthorization';
import { toApiChangeCase } from './changeCaseReadOperations';

type DraftEntitySaveResult = {
  entities: Entity[];
  draftEntities: Map<string, Entity>;
  allEntities: Entity[];
};

export const resolveDraftRelationIds = (
  schema: Awaited<ReturnType<DatabaseAdapter['catalog']['getSchema']>>,
  state: Record<string, unknown>,
  draftEntities: Map<string, Entity>
) => {
  const data = { ...asRecord(state['data']) };
  for (const field of schema?.fields ?? []) {
    if (field.type !== 'reference' && field.type !== 'containment') continue;
    const values = data[field.id];
    if (!Array.isArray(values)) continue;
    data[field.id] = values.map(value => {
      if (typeof value !== 'string') return value;
      return draftEntities.get(value)?.id ?? value;
    });
  }
  return data;
};

const normalizeCaseMemberState = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  entity: Entity,
  state: Record<string, unknown>,
  draftEntities: Map<string, Entity>,
  allEntities: Entity[]
) => {
  const schemaId = String(state['schema_id'] ?? entity.schema_id);
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 400, message: `Schema '${schemaId}' not found` });
  const data = resolveDraftRelationIds(schema, state, draftEntities);
  const normalizedData = normalizeEntityRelationFields({
    schema,
    fields: data,
    entities: allEntities
  });
  const currencyConfig = await db.workspace.getSupportedCurrencies(workspace);
  const enumDefinitions = await getWorkspaceEnumDefinitions(db, workspace);
  const normalizedScalarData = normalizeEntityScalarFields({
    schemaFields: schema.fields,
    fields: normalizedData,
    supportedCurrencies: new Set(currencyConfig.currencies.map(currency => currency.code)),
    validateMissing: false,
    enumDefinitions,
    previousFields: entity.data
  });
  return {
    ...state,
    schema_id: schemaId,
    data: normalizedScalarData,
    project_id: entity.project_id === projectId ? null : (state['project_id'] ?? null)
  };
};

const createProjectScopedDraftEntities = async (
  tx: DatabaseAdapter,
  workspace: string,
  projectId: string,
  drafts: CreateChangeCaseRequest['newEntities'],
  projectOwner: string | null,
  authCtx: AuthorizationContext,
  actor: { id: string; displayName: string | null }
): Promise<DraftEntitySaveResult> => {
  const [globalEntities, projectEntities] = await Promise.all([
    listAllCatalogEntities(tx, workspace),
    listAllCatalogEntities(tx, workspace, { projectId, projectScope: 'project' })
  ]);
  const existingEntities = [
    ...new Map([...globalEntities, ...projectEntities].map(entity => [entity.id, entity])).values()
  ];
  const schemas = await tx.catalog.listSchemas(workspace);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const draftIds = new Set<string>();
  const draftEntities = new Map<string, Entity>();
  const timestamp = new Date();

  for (const draft of drafts) {
    httpAssert.true(!draftIds.has(draft.draftId), {
      status: 400,
      message: `Duplicate draft entity '${draft.draftId}'`
    });
    draftIds.add(draft.draftId);
    const schemaId = String(draft.state['schema_id'] ?? '');
    const schema = schemaById.get(schemaId);
    httpAssert.present(schema, { status: 400, message: `Schema '${schemaId}' not found` });
    const state = draft.state;
    const name = String(state['name'] ?? '').trim();
    httpAssert.true(name.length > 0, { status: 400, message: 'New entity name is required' });
    const entity: EntityDbCreate = {
      id: randomUUID(),
      workspace,
      public_id: '',
      slug: String(state['slug'] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
      namespace: String(state['namespace'] ?? 'default'),
      name,
      description: String(state['description'] ?? ''),
      owner: (state['owner'] as string | null) ?? null,
      lifecycle: (state['lifecycle'] as string | null) ?? null,
      target_lifecycle: (state['target_lifecycle'] as string | null) ?? null,
      target_lifecycle_date: (state['target_lifecycle_date'] as string | null) ?? null,
      tags: Array.isArray(state['tags'])
        ? state['tags'].filter((v): v is string => typeof v === 'string')
        : [],
      links: Array.isArray(state['links']) ? state['links'] : [],
      schema_id: schemaId,
      data: asRecord(state['data']),
      project_id: projectId,
      created_at: timestamp,
      updated_at: timestamp,
      completeness: 0
    };
    draftEntities.set(draft.draftId, entity);
  }

  const allDrafts = [...draftEntities.values()];
  const allEntities = [...existingEntities, ...allDrafts];
  const entityLookup = new Map(allEntities.map(entity => [entity.id, entity]));
  const lifecycleValues = await getLifecycleValues(tx, workspace);
  const teamIds = await getTeamIds(tx, workspace);
  const fallbackOwner = (await tx.workspace.listTeams(workspace))[0]?.id ?? null;
  const currencyConfig = await tx.workspace.getSupportedCurrencies(workspace);
  const supportedCurrencies = new Set(currencyConfig.currencies.map(currency => currency.code));
  const enumDefinitions = await getWorkspaceEnumDefinitions(tx, workspace);

  for (const [draftId, entity] of draftEntities) {
    const schema = schemaById.get(entity.schema_id)!;
    const normalizedRelationData = normalizeEntityRelationFields({
      schema,
      fields: resolveDraftRelationIds(schema, { data: entity.data }, draftEntities),
      entities: allEntities
    });
    entity.data = normalizeEntityScalarFields({
      schemaFields: schema.fields,
      fields: normalizedRelationData,
      supportedCurrencies,
      enumDefinitions,
      previousFields: entity.data
    });
    const parents = getEntityParentsFromPayload(schema, entity.data, entityLookup);
    entity.owner = resolveCreateOwner(entity.owner, parents, schema, teamIds, fallbackOwner);
    if (entity.lifecycle && !lifecycleValues.has(entity.lifecycle)) entity.lifecycle = null;
    if (entity.target_lifecycle && !lifecycleValues.has(entity.target_lifecycle)) {
      entity.target_lifecycle = null;
    }
    if (authCtx) {
      requireNoRestrictedFieldWrites(
        authCtx,
        schema,
        Object.keys(entity.data),
        'You do not have permission to set one or more restricted fields on this entity'
      );
      if (parents.length > 0) {
        parents.forEach(parent =>
          requireEntityAction(
            authCtx,
            parent,
            'create_child',
            'You do not have permission to add children under one or more parent entities'
          )
        );
      } else {
        requireProjectAction(
          authCtx,
          projectOwner,
          'edit_project',
          'You do not have permission to create project entities'
        );
      }
    }
    entity.public_id = await allocateEntityPublicId(tx, workspace, entity.schema_id, timestamp);
    entity.completeness = computeEntityCompleteness(entity, schema);
    const created = await createEntityWithAudit(tx, { workspace, entity, actor });
    draftEntities.set(draftId, created);
    await tx.project.projectEntities.addProjectEntity({
      workspace,
      project_id: projectId,
      entity_id: created.id,
      entity_type_id: null,
      is_done: false,
      created_at: timestamp
    });
  }

  return {
    entities: [...draftEntities.values()],
    draftEntities,
    allEntities: [...existingEntities, ...draftEntities.values()]
  };
};

export const assertDraftReferences = (
  members: CreateChangeCaseRequest['members'],
  drafts: CreateChangeCaseRequest['newEntities']
) => {
  const draftIds = new Set(drafts.map(draft => draft.draftId));
  const referencedDraftIds = new Set(
    members.flatMap(member => (member.draftId == null ? [] : [member.draftId]))
  );
  for (const draftId of referencedDraftIds) {
    httpAssert.true(draftIds.has(draftId), {
      status: 400,
      message: `Draft entity '${draftId}' is not defined`
    });
  }
  for (const draftId of draftIds) {
    httpAssert.true(referencedDraftIds.has(draftId), {
      status: 400,
      message: `Draft entity '${draftId}' is not part of the change case`
    });
  }
};

const resolveDraftMembers = async (
  tx: DatabaseAdapter,
  ws: string,
  projectId: string,
  members: CreateChangeCaseRequest['members'],
  draftResult: DraftEntitySaveResult,
  authCtx: AuthorizationContext
) =>
  Promise.all(
    members.map(async member => {
      const entity = member.draftId
        ? draftResult.draftEntities.get(member.draftId)
        : await tx.catalog.getEntity(ws, member.entityId!);
      httpAssert.present(entity, {
        status: 404,
        message: `Entity '${member.entityId ?? member.draftId}' not found`
      });
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        `You do not have permission to edit entity '${entity.id}'`
      );
      await assertEntityBelongsToProject(tx, ws, projectId, entity);
      const proposedState = await normalizeCaseMemberState(
        tx,
        ws,
        projectId,
        entity,
        member.proposedState,
        draftResult.draftEntities,
        draftResult.allEntities
      );
      await requireNoRestrictedCaseMemberWrites(tx, ws, authCtx, entity, proposedState);
      return { entity, proposedState };
    })
  );

const assertUniqueMemberEntities = (members: Array<{ entity: Entity }>) => {
  const desiredIds = new Set<string>();
  for (const member of members) {
    httpAssert.true(!desiredIds.has(member.entity.id), {
      status: 409,
      message: `Entity '${member.entity.id}' is already part of the change case`
    });
    desiredIds.add(member.entity.id);
  }
};

export const createChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent,
  body: CreateChangeCaseRequest
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to create change case',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);
      assertDraftReferences(body.members, body.newEntities);

      const { effectiveDate, milestoneId } = await resolveEffectiveDate(
        db,
        ws,
        project.id,
        body.targetDate,
        body.milestoneId
      );

      const actor = {
        id: event.context.user.id,
        displayName: event.context.user.display_name
      };
      const changeCase = await db.core.transaction(async tx => {
        const draftResult = await createProjectScopedDraftEntities(
          tx,
          ws,
          project.id,
          body.newEntities,
          project.owner,
          authCtx,
          actor
        );
        const desired = await resolveDraftMembers(
          tx,
          ws,
          project.id,
          body.members,
          draftResult,
          authCtx
        );
        return tx.changeCase.createCase({
          id: randomUUID(),
          workspace: ws,
          project_id: project.id,
          name: body.name,
          description: body.description ?? null,
          effective_date: effectiveDate,
          milestone_id: milestoneId,
          message: body.commitMessage ?? null,
          created_by: event.context.user.id,
          created_at: new Date(),
          members: desired.map(member =>
            buildMemberInput(member.entity, member.proposedState, project.id)
          )
        });
      });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  });
};

export const saveChangeCaseDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: SaveChangeCaseDraftRequest
): Promise<ChangeCase> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'entity', workspace: workspace },
    fallback: 'Failed to save change case draft',
    operation: async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);
      assertDraftReferences(body.members, body.newEntities);
      const existingCase = await getCaseOrThrow(db, ws, caseId);
      httpAssert.true(existingCase.project_id === project.id, {
        status: 400,
        message: 'Change case does not belong to this project'
      });
      httpAssert.true(existingCase.status === 'planned', {
        status: 409,
        message: 'Only planned change cases can be edited'
      });
      await getActiveRevisionOrThrow(db, ws, caseId);

      let effectiveDate: string | null | undefined;
      let milestoneId: string | null | undefined;
      if (body.targetDate !== undefined || body.milestoneId !== undefined) {
        const resolved = await resolveEffectiveDate(
          db,
          ws,
          project.id,
          body.targetDate,
          body.milestoneId
        );
        effectiveDate = resolved.effectiveDate;
        milestoneId = resolved.milestoneId;
      }

      const actor = {
        id: event.context.user.id,
        displayName: event.context.user.display_name
      };
      const updated = await db.core.transaction(async tx => {
        const revision = await getActiveRevisionOrThrow(tx, ws, caseId);
        const currentMembers = await tx.changeCase.listMembers(ws, revision.id);
        const draftResult = await createProjectScopedDraftEntities(
          tx,
          ws,
          project.id,
          body.newEntities,
          project.owner,
          authCtx,
          actor
        );
        const desired = await resolveDraftMembers(
          tx,
          ws,
          project.id,
          body.members,
          draftResult,
          authCtx
        );
        assertUniqueMemberEntities(desired);

        for (const member of currentMembers) {
          if (!desired.some(candidate => candidate.entity.id === member.entity_id)) {
            await tx.changeCase.removeMember(ws, member.id);
          }
        }
        for (const member of desired) {
          const existingMember = currentMembers.find(
            candidate => candidate.entity_id === member.entity.id
          );
          if (existingMember) {
            await tx.changeCase.updateMemberProposedState(
              ws,
              existingMember.id,
              member.proposedState,
              {}
            );
          } else {
            await tx.changeCase.addMember(
              ws,
              revision.id,
              buildMemberInput(member.entity, member.proposedState, project.id)
            );
          }
        }
        await tx.changeCase.updateCaseFields(ws, caseId, {
          name: body.name,
          target_date: effectiveDate,
          milestone_id: milestoneId,
          message: body.commitMessage
        });
        return (await tx.changeCase.getCase(ws, caseId))!;
      });
      return toApiChangeCase(db, ws, updated, authCtx);
    }
  });
};
