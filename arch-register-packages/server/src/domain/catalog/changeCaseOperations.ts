import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { defineEntityOperation } from '../operation';
import {
  requireEntityAction,
  requireProjectAccess,
  requireProjectAction
} from '../auth/authorization';
import { updateEntity } from './entityMutationOperations';
import { allocateEntityPublicId } from './entityMutationOperations';
import { createEntityWithAudit, entityToBaseState } from './entityMutations';
import type {
  Entity,
  EntityDbCreate,
  EntityVersionDbResult,
  SchemaDbResult
} from './db/catalogDatabase';
import {
  filterRestrictedFieldGroups,
  requireNoRestrictedFieldWrites,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import { equalEntityValue } from './entityDiff';
import { computeEntityCompleteness } from '../../utils/completeness';
import {
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields,
  resolveCreateOwner
} from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import type {
  ChangeCaseDbResult,
  ChangeCaseMemberDbResult,
  ChangeCaseRevisionDbResult
} from './db/changeCaseDatabase';
import type {
  ChangeCase,
  ChangeCaseApplyConflict,
  ApplyChangeCaseRequest,
  CreateChangeCaseRequest,
  SaveChangeCaseDraftRequest,
  UpdateChangeCaseRequest
} from '@arch-register/api-types/changeCaseContract';

const getProjectOrThrow = async (db: DatabaseAdapter, ws: string, projectId: string) => {
  const project = await db.project.getProject(ws, projectId);
  httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
  return project;
};

const assertEntityBelongsToProject = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  entity: Entity
) => {
  if (entity.project_id === projectId) return;
  const linked = await db.project.isEntityLinkedToProject(ws, projectId, entity.id);
  httpAssert.true(linked, {
    status: 400,
    message: `Entity '${entity.id}' is not part of this project`
  });
};

const resolveEffectiveDate = async (
  db: DatabaseAdapter,
  ws: string,
  projectId: string,
  targetDate: string | null | undefined,
  milestoneId: string | null | undefined
): Promise<{ effectiveDate: string | null; milestoneId: string | null }> => {
  if (milestoneId == null) return { effectiveDate: targetDate ?? null, milestoneId: null };
  const milestone = await db.project.getMilestone(ws, projectId, milestoneId);
  httpAssert.present(milestone, { status: 404, message: 'Milestone not found' });
  return { effectiveDate: milestone.target_date, milestoneId: milestone.id };
};

const getCaseOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const changeCase = await db.changeCase.getCase(ws, caseId);
  httpAssert.present(changeCase, { status: 404, message: `Change case '${caseId}' not found` });
  return changeCase;
};

const getActiveRevisionOrThrow = async (db: DatabaseAdapter, ws: string, caseId: string) => {
  const revision = await db.changeCase.getActiveRevision(ws, caseId);
  httpAssert.present(revision, {
    status: 409,
    message: 'This change case has already been applied, withdrawn, or has no active revision'
  });
  return revision;
};

const requireCaseEditAccess = (authCtx: AuthorizationContext, project: { owner: string | null }) =>
  requireProjectAction(
    authCtx,
    project.owner,
    'edit_project',
    'You do not have permission to edit change cases in this project'
  );

const redactMemberStateData = (
  state: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  schema: FieldGroupSchemaShape | null
): Record<string, unknown> => {
  const data = state['data'];
  if (data == null || typeof data !== 'object') return state;
  return {
    ...state,
    data: filterRestrictedFieldGroups(authCtx, schema, data as Record<string, unknown>)
  };
};

const toApiChangeCase = async (
  db: DatabaseAdapter,
  ws: string,
  changeCase: ChangeCaseDbResult,
  authCtx: AuthorizationContext | null
): Promise<ChangeCase> => {
  const revision = await db.changeCase.getLatestRevision(ws, changeCase.id);
  const members = revision ? await db.changeCase.listMembers(ws, revision.id) : [];
  const schemas = members.length > 0 ? await db.catalog.listSchemas(ws) : [];
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
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
    members: members.map(member => toApiMember(member, authCtx, schemaById))
  };
};

export const toApiMember = (
  member: ChangeCaseMemberDbResult,
  authCtx: AuthorizationContext | null,
  schemaById: Map<string, SchemaDbResult>
) => {
  const baseState = member.base_state;
  const proposedState = member.proposed_state;
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

const buildMemberInput = (
  entity: Entity,
  proposedState: Record<string, unknown>,
  projectId?: string
) => ({
  entity_id: entity.id,
  base_version: entity.version ?? 1,
  base_state: entityToBaseState(entity),
  proposed_state:
    projectId != null && entity.project_id === projectId
      ? { ...proposedState, project_id: null }
      : proposedState,
  diff: {}
});

type DraftEntitySaveResult = {
  entities: Entity[];
  draftEntities: Map<string, Entity>;
  allEntities: Entity[];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const resolveDraftRelationIds = (
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
  return {
    ...state,
    schema_id: schemaId,
    data: normalizedData,
    project_id: entity.project_id === projectId ? null : (state['project_id'] ?? null)
  };
};

export const requireNoRestrictedCaseMemberWrites = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  entity: Entity,
  proposedState: Record<string, unknown>
) => {
  const schemaId = String(proposedState['schema_id'] ?? entity.schema_id);
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 400, message: `Schema '${schemaId}' not found` });

  const proposedData = asRecord(proposedState['data']);
  const changedFieldIds = Object.keys(proposedData).filter(
    fieldId => !equalEntityValue(entity.data[fieldId], proposedData[fieldId])
  );
  requireNoRestrictedFieldWrites(
    authCtx,
    schema,
    changedFieldIds,
    'You do not have permission to edit one or more restricted fields on this entity'
  );
};

const toEntityMutationPayload = (
  entity: Entity,
  state: Record<string, unknown>,
  projectId: string
) => {
  if (state['_schemaId'] != null || state['_schema'] != null) {
    return entity.project_id === projectId ? { ...state, _projectId: null } : state;
  }
  const data = asRecord(state['data']);
  return {
    _schemaId: state['schema_id'] ?? entity.schema_id,
    _name: state['name'] ?? entity.name,
    _slug: state['slug'] ?? entity.slug,
    _namespace: state['namespace'] ?? entity.namespace,
    _description: state['description'] ?? entity.description,
    _owner: state['owner'] ?? null,
    _lifecycle: state['lifecycle'] ?? null,
    _targetLifecycle: state['target_lifecycle'] ?? null,
    _targetLifecycleDate: state['target_lifecycle_date'] ?? null,
    _tags: state['tags'] ?? entity.tags,
    _links: state['links'] ?? entity.links,
    _projectId: entity.project_id === projectId ? null : (state['project_id'] ?? null),
    ...data
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

  for (const [draftId, entity] of draftEntities) {
    const schema = schemaById.get(entity.schema_id)!;
    entity.data = normalizeEntityRelationFields({
      schema,
      fields: resolveDraftRelationIds(schema, { data: entity.data }, draftEntities),
      entities: allEntities
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
    await tx.project.addProjectEntity({
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

const assertDraftReferences = (
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

export const listChangeCasesByProject = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase[]> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve change cases' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const rows = await db.changeCase.listCasesByProject(ws, project.id);
      return Promise.all(rows.map(row => toApiChangeCase(db, ws, row, authCtx)));
    }
  );
};

export const listChangeCasesByEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase[]> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve change cases' },
    async ({ ws, authCtx }) => {
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
  );
};

export const getChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  );
};

export const createChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  event: AuthenticatedEvent,
  body: CreateChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create change case' },
    async ({ ws, authCtx }) => {
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
        const members = await Promise.all(
          body.members.map(async member => {
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
            await assertEntityBelongsToProject(tx, ws, project.id, entity);
            const proposedState = await normalizeCaseMemberState(
              tx,
              ws,
              project.id,
              entity,
              member.proposedState,
              draftResult.draftEntities,
              draftResult.allEntities
            );
            await requireNoRestrictedCaseMemberWrites(tx, ws, authCtx, entity, proposedState);
            return buildMemberInput(entity, proposedState, project.id);
          })
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
          members
        });
      });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  );
};

export const addEntityToChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: { entityId: string; proposedState: Record<string, unknown> }
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to add entity to change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      httpAssert.true(changeCase.project_id === project.id, {
        status: 400,
        message: 'Change case does not belong to this project'
      });
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);

      const entity = await db.catalog.getEntity(ws, body.entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${body.entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        `You do not have permission to edit entity '${entity.id}'`
      );
      await assertEntityBelongsToProject(db, ws, project.id, entity);

      await requireNoRestrictedCaseMemberWrites(db, ws, authCtx, entity, body.proposedState);

      const existingMembers = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(!existingMembers.some(member => member.entity_id === entity.id), {
        status: 409,
        message: 'This entity is already part of the change case'
      });

      await db.changeCase.addMember(ws, revision.id, buildMemberInput(entity, body.proposedState));

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  );
};

export const removeEntityFromChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  memberId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to remove entity from change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const members = await db.changeCase.listMembers(ws, revision.id);
      httpAssert.true(
        members.some(member => member.id === memberId),
        {
          status: 404,
          message: 'Change case member not found'
        }
      );
      httpAssert.true(members.length > 1, {
        status: 400,
        message: 'A change case must retain at least one entity'
      });

      const removed = await db.changeCase.removeMember(ws, memberId);
      httpAssert.present(removed, { status: 404, message: 'Change case member not found' });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  );
};

export const updateChangeCaseMemberProposedState = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  memberId: string,
  event: AuthenticatedEvent,
  body: { proposedState: Record<string, unknown> }
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update change case member' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      const changeCase = await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const members = await db.changeCase.listMembers(ws, revision.id);
      const member = members.find(candidate => candidate.id === memberId);
      httpAssert.present(member, { status: 404, message: 'Change case member not found' });

      const entity = await db.catalog.getEntity(ws, member.entity_id);
      httpAssert.present(entity, { status: 404, message: 'Entity not found' });
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        `You do not have permission to edit entity '${entity.id}'`
      );

      await requireNoRestrictedCaseMemberWrites(db, ws, authCtx, entity, body.proposedState);

      const updated = await db.changeCase.updateMemberProposedState(
        ws,
        memberId,
        body.proposedState,
        {}
      );
      httpAssert.present(updated, { status: 404, message: 'Change case member not found' });

      return toApiChangeCase(db, ws, changeCase, authCtx);
    }
  );
};

export const updateChangeCaseFields = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: UpdateChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
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

      const updated = await db.changeCase.updateCaseFields(ws, caseId, {
        name: body.name,
        target_date: effectiveDate,
        milestone_id: milestoneId,
        message: body.commitMessage
      });
      httpAssert.present(updated, { status: 404, message: `Change case '${caseId}' not found` });

      return toApiChangeCase(db, ws, updated, authCtx);
    }
  );
};

export const saveChangeCaseDraft = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: SaveChangeCaseDraftRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to save change case draft' },
    async ({ ws, authCtx }) => {
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
        const desired = await Promise.all(
          body.members.map(async member => {
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
            await assertEntityBelongsToProject(tx, ws, project.id, entity);
            const proposedState = await normalizeCaseMemberState(
              tx,
              ws,
              project.id,
              entity,
              member.proposedState,
              draftResult.draftEntities,
              draftResult.allEntities
            );
            await requireNoRestrictedCaseMemberWrites(tx, ws, authCtx, entity, proposedState);
            return { entity, proposedState };
          })
        );
        const desiredIds = new Set<string>();
        for (const member of desired) {
          httpAssert.true(!desiredIds.has(member.entity.id), {
            status: 409,
            message: `Entity '${member.entity.id}' is already part of the change case`
          });
          desiredIds.add(member.entity.id);
        }

        for (const member of currentMembers) {
          if (!desiredIds.has(member.entity_id)) {
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
  );
};

export const withdrawChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to withdraw change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      await getActiveRevisionOrThrow(db, ws, caseId);

      const withdrawn = await db.changeCase.withdrawCase(ws, caseId);
      httpAssert.present(withdrawn, { status: 404, message: `Change case '${caseId}' not found` });

      return toApiChangeCase(db, ws, withdrawn, authCtx);
    }
  );
};

export const deleteChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<{ success: true; message: string }> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);

      const deleted = await db.changeCase.deleteCase(ws, caseId);
      httpAssert.present(deleted, {
        status: 409,
        message: 'Only a still-planned change case can be deleted; withdraw it instead'
      });

      return { success: true as const, message: 'Change case deleted' };
    }
  );
};

const buildConflicts = async (
  db: DatabaseAdapter,
  ws: string,
  revision: ChangeCaseRevisionDbResult
): Promise<{ conflicts: ChangeCaseApplyConflict[]; members: ChangeCaseMemberDbResult[] }> => {
  const members = await db.changeCase.listMembers(ws, revision.id);
  const conflicts = await Promise.all(
    members.map(async member => {
      const entity = await db.catalog.getEntity(ws, member.entity_id);
      httpAssert.present(entity, {
        status: 404,
        message: `Entity '${member.entity_id}' no longer exists`
      });
      const currentVersion = entity.version ?? 1;
      return {
        memberId: member.id,
        entityId: member.entity_id,
        baseVersion: member.base_version,
        currentVersion,
        stale: currentVersion !== member.base_version
      };
    })
  );
  return { conflicts, members };
};

export const checkChangeCaseApplyConflicts = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent
): Promise<ChangeCaseApplyConflict[]> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to check change case conflicts' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireProjectAccess(authCtx, project.owner);

      await getCaseOrThrow(db, ws, caseId);
      const revision = await getActiveRevisionOrThrow(db, ws, caseId);
      const { conflicts } = await buildConflicts(db, ws, revision);
      return conflicts;
    }
  );
};

export const applyChangeCase = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  caseId: string,
  event: AuthenticatedEvent,
  body: ApplyChangeCaseRequest
): Promise<ChangeCase> => {
  return defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to apply change case' },
    async ({ ws, authCtx }) => {
      const project = await getProjectOrThrow(db, ws, projectId);
      requireCaseEditAccess(authCtx, project);

      await getCaseOrThrow(db, ws, caseId);
      const revisionBeforeApply = await getActiveRevisionOrThrow(db, ws, caseId);
      const { members } = await buildConflicts(db, ws, revisionBeforeApply);

      httpAssert.true(body.resolutions.length === members.length, {
        status: 400,
        message: 'A resolution must be supplied for every member entity of this case'
      });
      for (const member of members) {
        httpAssert.true(
          body.resolutions.some(resolution => resolution.memberId === member.id),
          { status: 400, message: `Missing resolution for entity '${member.entity_id}'` }
        );
      }

      const actor = {
        id: event.context.user.id,
        displayName: event.context.user.display_name
      };

      const appliedCase = await db.core.transaction(async tx => {
        const revision = await tx.changeCase.getActiveRevision(ws, caseId);
        httpAssert.present(revision, {
          status: 409,
          message: 'This change case has already been applied or withdrawn'
        });
        const txMembers = await tx.changeCase.listMembers(ws, revision.id);

        for (const member of txMembers) {
          const entity = await tx.catalog.getEntity(ws, member.entity_id);
          httpAssert.present(entity, {
            status: 404,
            message: `Entity '${member.entity_id}' no longer exists`
          });
          httpAssert.true((entity.version ?? 1) === member.base_version, {
            status: 409,
            message: `Entity '${member.entity_id}' changed since this case was planned; conflicts must be re-resolved`
          });
        }

        for (const member of txMembers) {
          const entity = await tx.catalog.getEntity(ws, member.entity_id);
          httpAssert.present(entity, {
            status: 404,
            message: `Entity '${member.entity_id}' no longer exists`
          });
          const resolution = body.resolutions.find(candidate => candidate.memberId === member.id)!;

          const resolvedEntityData = toEntityMutationPayload(
            entity,
            resolution.resolvedEntityData,
            project.id
          );
          await updateEntity(tx, ws, member.entity_id, resolvedEntityData, authCtx, actor, {
            versionKind: 'case_applied',
            appliedCaseRevisionId: revision.id,
            projectId: project.id
          });

          const versions: EntityVersionDbResult[] = await tx.catalog.listEntityVersions(
            ws,
            member.entity_id
          );
          const appliedVersion: EntityVersionDbResult | undefined = versions.find(
            v => v.applied_case_revision_id === revision.id
          );
          httpAssert.present(appliedVersion, {
            status: 500,
            message: `Failed to record the applied version for entity '${member.entity_id}'`
          });
          await tx.changeCase.markMemberApplied(ws, member.id, appliedVersion.id);
        }

        const now = new Date();
        await tx.changeCase.markRevisionApplied(ws, revision.id, now);
        await tx.changeCase.markCaseApplied(ws, caseId, now);

        return (await tx.changeCase.getCase(ws, caseId))!;
      });

      return toApiChangeCase(db, ws, appliedCase, authCtx);
    }
  );
};
