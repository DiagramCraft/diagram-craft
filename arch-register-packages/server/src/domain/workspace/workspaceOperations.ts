import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireGlobalPermission } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { logAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { HTTPError } from 'h3';
import { handleDbError, slugify } from '../../utils/http';
import { AR_COLOR_BLUE, AR_COLOR_GREEN, AR_COLOR_YELLOW } from '@arch-register/api-types/colors';
import { toApiWorkspace } from './workspaceHelpers';
import { instantiateTemplateDefinitions } from '../catalog/schemaTemplates';
import type { WorkspaceDbResult } from './db/workspaceDatabase';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { formatPublicId, validatePublicIdPrefix } from '../../utils/publicIds';
import { ensureNotificationDeliverySchedule } from '../notification/emailDelivery';
import { ensureGovernanceDeadlineScanSchedule } from '../governance/governanceDeadlineScanJob';
import { computeEntityCompleteness } from '../../utils/completeness';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import { normalizeEntityScalarFields } from '../catalog/entityScalarValues';
import { DOCUMENT_STATUS_CASE_KIND } from '../document/documentWorkflowOperations';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../catalog/fieldDateReminderJob';
import {
  ENTITY_CHANGE_POLICY_CASE_KIND,
  ENTITY_DEPRECATION_POLICY_CASE_KIND
} from '../governance/schemaGovernancePolicy';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';
import { replaceDefaultWorkspaceDashboardLayout } from '../dashboard/dashboardOperations';
import { coordinateContentWrite } from '../project/contentWriteCoordinator';
import { createLogger } from '../../utils/logger';
import type { WorkspaceCapabilityBindings } from '@arch-register/api-types/workspaceCapabilityContract';
import { listWorkspaceCapabilityConfigurations } from './workspaceCapabilityOperations';

const shortCodeFrom = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (w[0] ?? '').toUpperCase())
    .join('')
    .slice(0, 5);

const logger = createLogger('workspace-operations');

const generateCopiedSchemaKeyPrefix = (seed: string) => {
  const bytes = createHash('sha1').update(seed).digest();
  let prefix = '';
  for (const byte of bytes) {
    prefix += String.fromCharCode(65 + (byte % 26));
    if (prefix.length === 5) break;
  }
  return prefix;
};

const remapGovernanceConfigTeams = (
  config: Record<string, unknown>,
  teamMap: Map<string, string>
): GovernanceWorkflowConfig => {
  const remapTargets = (value: unknown) => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return value;
    const targets = value as Record<string, unknown>;
    return {
      ...targets,
      ...(Array.isArray(targets['fallbackTeamIds']) && {
        fallbackTeamIds: (targets['fallbackTeamIds'] as unknown[]).map(id =>
          typeof id === 'string' ? (teamMap.get(id) ?? id) : id
        )
      })
    };
  };

  return {
    ...config,
    ...(config['approvals'] !== undefined && { approvals: remapTargets(config['approvals']) }),
    ...(config['escalation'] !== undefined && {
      escalation: remapTargets(config['escalation'])
    }),
    extensions:
      config['extensions'] != null && typeof config['extensions'] === 'object'
        ? (config['extensions'] as Record<string, unknown>)
        : {}
  } as GovernanceWorkflowConfig;
};

const remappedCloneGovernanceSubkind = (
  caseKind: string,
  caseSubkind: string | null,
  schemaMap: Map<string, string>
): string | null | undefined => {
  if (caseSubkind == null) {
    return caseKind === ENTITY_CHANGE_POLICY_CASE_KIND ||
      caseKind === ENTITY_DEPRECATION_POLICY_CASE_KIND
      ? null
      : undefined;
  }
  if (
    caseKind === ENTITY_CHANGE_POLICY_CASE_KIND ||
    caseKind === ENTITY_DEPRECATION_POLICY_CASE_KIND
  ) {
    return schemaMap.get(caseSubkind);
  }
  if (caseKind === FIELD_DATE_REMINDER_CASE_KIND) {
    const separator = caseSubkind.indexOf(':');
    if (separator <= 0) return undefined;
    const schemaId = schemaMap.get(caseSubkind.slice(0, separator));
    return schemaId ? `${schemaId}:${caseSubkind.slice(separator + 1)}` : undefined;
  }
  return undefined;
};

const buildCreateInput = (
  input: {
    name: string;
    description?: string;
    color?: string;
    slug?: string;
    badge?: string;
  },
  createdAt: Date
) => {
  const urlSlug = slugify(input.slug ?? input.name);
  if (!urlSlug) {
    throw Object.assign(new Error('name must contain at least one alphanumeric character'), {
      status: 400
    });
  }
  return {
    id: randomUUID(),
    name: input.name,
    url_slug: urlSlug,
    short_code: validatePublicIdPrefix(input.badge ?? shortCodeFrom(input.name), 'short_code')!,
    color: input.color ?? '',
    description: input.description ?? '',
    created_at: createdAt,
    updated_at: createdAt
  };
};

const buildUpdateInput = (
  input: {
    name: string;
    description?: string;
    url_slug?: string;
    short_code?: string;
    color?: string;
  },
  current: WorkspaceDbResult,
  updatedAt: Date
) => ({
  name: input.name,
  url_slug:
    input.url_slug != null ? (slugify(input.url_slug) ?? current.url_slug) : current.url_slug,
  short_code:
    input.short_code !== undefined
      ? validatePublicIdPrefix(input.short_code, 'short_code')!
      : current.short_code,
  color: input.color ?? current.color,
  description: input.description ?? current.description,
  updated_at: updatedAt
});

const buildDefaultLifecycleStates = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    label: 'Proposed',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Experimental',
    color: AR_COLOR_BLUE,
    sort_order: 1,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Production',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    label: 'Deprecated',
    color: AR_COLOR_YELLOW,
    sort_order: 3,
    created_at: createdAt
  }
];

const buildDefaultProjectEntityTypes = (workspace: string, createdAt: Date) => [
  { id: randomUUID(), workspace, label: 'Introduced', sort_order: 0, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Decommissioned', sort_order: 1, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Modified', sort_order: 2, created_at: createdAt },
  { id: randomUUID(), workspace, label: 'Used', sort_order: 3, created_at: createdAt }
];

const buildDefaultWorkspaceTeams = (workspace: string, createdAt: Date) => [
  {
    id: randomUUID(),
    workspace,
    name: 'Platform Team',
    sort_order: 0,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'UX Team',
    sort_order: 1,
    color: null,
    description: '',
    created_at: createdAt
  },
  {
    id: randomUUID(),
    workspace,
    name: 'Security Team',
    sort_order: 2,
    color: null,
    description: '',
    created_at: createdAt
  }
];

const normalizeInclude = (include: string[] | undefined): Set<string> =>
  new Set<string>(include ?? ['schemas', 'settings']);

const remapDocumentMetadataValues = (
  fields: DocumentField[],
  sourceValues: DocumentMetadata,
  resolveEntity: (id: string) => string | undefined,
  resolveDocument: (id: string) => string | undefined
) => {
  const values = { ...sourceValues };
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const raw = values[field.id];
    if (raw === undefined) continue;
    const sourceIds = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const mapped = sourceIds
      .map(id => (field.type === 'entity_link' ? resolveEntity(id) : resolveDocument(id)))
      .filter((id): id is string => !!id);
    values[field.id] = Array.isArray(raw) ? mapped : (mapped[0] ?? null);
  }
  return values;
};

const copyTypedWorkspaceDocuments = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  sourceWorkspace: string,
  targetWorkspace: string,
  typeMap: Map<string, string>,
  projectMap: Map<string, string>,
  entityMap: Map<string, string>,
  timestamp: Date
): Promise<{
  nodeMap: Map<string, string>;
  sourceEntityIdByIdentifier: Map<string, string>;
}> => {
  const sourceEntityIdByIdentifier = new Map<string, string>();
  for (const entity of await db.catalog.listEntities(sourceWorkspace)) {
    sourceEntityIdByIdentifier.set(entity.id, entity.id);
    if (entity.public_id) sourceEntityIdByIdentifier.set(entity.public_id, entity.id);
  }
  const sourceNodes = (await db.project.listAllContentNodes(sourceWorkspace)).filter(
    node =>
      (node.project_id == null || projectMap.has(node.project_id)) &&
      (node.entity_id == null || entityMap.has(node.entity_id))
  );
  const sourceNodeById = new Map(sourceNodes.map(node => [node.id, node]));
  const sourceStates = new Map<
    string,
    Awaited<ReturnType<DatabaseAdapter['document']['getDocumentMetadata']>>
  >();
  const sourceRevisions = new Map<
    string,
    Awaited<ReturnType<DatabaseAdapter['project']['listMarkdownRevisions']>>
  >();
  const typedNodeIds = new Set<string>();

  for (const node of sourceNodes.filter(item => item.type === 'markdown')) {
    const state = await db.document.getDocumentMetadata(sourceWorkspace, node.id);
    const revisions = await db.project.listMarkdownRevisions(sourceWorkspace, node.id);
    sourceStates.set(node.id, state);
    sourceRevisions.set(node.id, revisions);
    if (state?.document_type_id || revisions.some(revision => revision.document_type_id))
      typedNodeIds.add(node.id);
  }

  const nodesToCopy = new Set<string>();
  for (const nodeId of typedNodeIds) {
    let node = sourceNodeById.get(nodeId);
    while (node) {
      nodesToCopy.add(node.id);
      node = node.parent_id ? sourceNodeById.get(node.parent_id) : undefined;
    }
  }

  const nodeMap = new Map<string, string>();
  for (const sourceNode of sourceNodes) {
    if (!nodesToCopy.has(sourceNode.id)) continue;
    nodeMap.set(sourceNode.id, randomUUID());
  }

  for (const sourceNode of sourceNodes) {
    const nodeId = nodeMap.get(sourceNode.id);
    if (!nodeId) continue;
    const sourceStorageScope = sourceNode.project_id ?? sourceNode.entity_id ?? sourceWorkspace;
    const targetStorageScope = sourceNode.project_id
      ? (projectMap.get(sourceNode.project_id) ?? targetWorkspace)
      : sourceNode.entity_id
        ? (entityMap.get(sourceNode.entity_id) ?? targetWorkspace)
        : targetWorkspace;
    const content =
      sourceNode.type === 'folder' || !storage
        ? null
        : await storage.read(sourceWorkspace, sourceStorageScope, sourceNode.id);
    await coordinateContentWrite({
      db,
      storage,
      operation: 'workspace-copy-content-node',
      scope: 'workspace-copy',
      nodeIds: [nodeId],
      storageChanges:
        content && storage
          ? [
              {
                type: 'write',
                workspace: targetWorkspace,
                storageId: targetStorageScope,
                nodeId,
                content
              }
            ]
          : undefined,
      writeDatabase: async tx => {
        await tx.project.upsertContentNode({
          id: nodeId,
          workspace: targetWorkspace,
          project_id: sourceNode.project_id
            ? (projectMap.get(sourceNode.project_id) ?? null)
            : null,
          entity_id: sourceNode.entity_id ? (entityMap.get(sourceNode.entity_id) ?? null) : null,
          parent_id: sourceNode.parent_id ? (nodeMap.get(sourceNode.parent_id) ?? null) : null,
          path: sourceNode.path,
          name: sourceNode.name,
          role: sourceNode.role,
          type: sourceNode.type,
          size_bytes: sourceNode.size_bytes,
          comment_count: sourceNode.comment_count,
          unresolved_comment_count: sourceNode.unresolved_comment_count,
          created_atIfNew: sourceNode.created_at,
          updated_at: timestamp,
          created_byIfNew: sourceNode.created_by,
          updated_by: sourceNode.updated_by,
          mime_type: sourceNode.mime_type,
          original_filename: sourceNode.original_filename,
          mount_id: null
        });
      }
    });
  }

  for (const nodeId of typedNodeIds) {
    const targetNodeId = nodeMap.get(nodeId);
    if (!targetNodeId) continue;
    const state = sourceStates.get(nodeId);
    const sourceTypeId = state?.document_type_id ?? null;
    const targetTypeId = sourceTypeId ? (typeMap.get(sourceTypeId) ?? null) : null;
    if (sourceTypeId && !targetTypeId) continue;
    if (state) {
      const sourceType = sourceTypeId
        ? await db.document.getDocumentType(sourceWorkspace, sourceTypeId)
        : null;
      const values = sourceType
        ? remapDocumentMetadataValues(
            sourceType.fields,
            state.values,
            id => entityMap.get(sourceEntityIdByIdentifier.get(id) ?? id),
            id => nodeMap.get(id)
          )
        : state.values;
      await db.document.upsertDocumentMetadata({
        workspace: targetWorkspace,
        node_id: targetNodeId,
        document_type_id: targetTypeId,
        values,
        generated_metadata: state.generated_metadata,
        updated_at: timestamp
      });
      const links = (await db.document.listDocumentLinks(sourceWorkspace, nodeId)).flatMap(link => {
        const targetId =
          link.target_type === 'entity'
            ? entityMap.get(sourceEntityIdByIdentifier.get(link.target_id) ?? link.target_id)
            : nodeMap.get(link.target_id);
        return targetId ? [{ ...link, target_id: targetId }] : [];
      });
      await db.document.replaceDocumentLinks(targetWorkspace, targetNodeId, links);
    }

    const revisionMap = new Map<string, string>();
    for (const revision of [...(sourceRevisions.get(nodeId) ?? [])].sort(
      (a, b) => a.revision_number - b.revision_number
    )) {
      const revisionId = randomUUID();
      revisionMap.set(revision.id, revisionId);
      const revisionType = revision.document_type_id
        ? await db.document.getDocumentType(sourceWorkspace, revision.document_type_id)
        : null;
      const revisionValues = revisionType
        ? remapDocumentMetadataValues(
            revisionType.fields,
            revision.metadata,
            id => entityMap.get(sourceEntityIdByIdentifier.get(id) ?? id),
            id => nodeMap.get(id)
          )
        : revision.metadata;
      await db.project.createMarkdownRevision({
        id: revisionId,
        workspace: targetWorkspace,
        node_id: targetNodeId,
        revision_number: revision.revision_number,
        title: revision.title,
        body: revision.body,
        created_at: revision.created_at,
        created_by: revision.created_by,
        restored_from_revision_id: revision.restored_from_revision_id
          ? (revisionMap.get(revision.restored_from_revision_id) ?? null)
          : null,
        document_type_id: revision.document_type_id
          ? (typeMap.get(revision.document_type_id) ?? null)
          : null,
        metadata: revisionValues
      });
    }
  }
  return { nodeMap, sourceEntityIdByIdentifier };
};

export const listWorkspaces = async (
  db: DatabaseAdapter,
  event?: AuthenticatedEvent
): Promise<Workspace[]> => {
  try {
    const workspaces = event?.context.apiToken
      ? await db.workspace
          .getWorkspace(event.context.apiToken.workspace)
          .then(workspace => (workspace ? [workspace] : []))
      : await db.workspace.listWorkspaces();
    return workspaces.map(toApiWorkspace);
  } catch (e) {
    return handleDbError(e, 'Failed to retrieve workspaces', {
      unique: 'A workspace with that name already exists'
    });
  }
};

export const createWorkspace = async (
  db: DatabaseAdapter,
  input: {
    name: string;
    description?: string;
    color?: string;
    slug?: string;
    badge?: string;
    template?: string;
    replicate_from?: string;
    include?: string[];
  },
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<Workspace> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'global' },
    fallback: 'Failed to create workspace',
    dbErrorMessages: { unique: 'A workspace with that name already exists' },
    operation: async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const timestamp = new Date();
      const row = await db.workspace.createWorkspace(buildCreateInput(input, timestamp));
      try {
        await ensureNotificationDeliverySchedule(db, row.id, timestamp);
        await ensureGovernanceDeadlineScanSchedule(db, row.id, timestamp);
        await db.workspace.registerPublicIdPrefix(row.short_code, 'workspace', row.id, timestamp);

        const { template, replicate_from, include } = input;

        if (typeof replicate_from === 'string' && replicate_from) {
          const includeSet = normalizeInclude(include);

          const [
            srcLifecycle,
            srcTeams,
            srcRoles,
            srcSchemas,
            srcSharedFieldGroups,
            srcGovernanceConfigs,
            srcCapabilityConfigurations
          ] = await Promise.all([
            db.workspace.listLifecycleStates(replicate_from),
            db.workspace.listTeams(replicate_from),
            db.workspace.listCustomWorkspaceRoles(replicate_from),
            db.catalog.listSchemas(replicate_from),
            db.catalog.listSharedFieldGroups(replicate_from),
            db.governanceCaseConfig.listCaseConfig(replicate_from),
            listWorkspaceCapabilityConfigurations(db, replicate_from)
          ]);

          const lifecycleMap = new Map<string, string>();
          const teamMap = new Map<string, string>();

          if (includeSet.has('settings')) {
            const lifecycleStates =
              srcLifecycle.length > 0
                ? srcLifecycle.map(s => {
                    const id = randomUUID();
                    lifecycleMap.set(s.id, id);
                    return { ...s, id, workspace: row.id, created_at: timestamp };
                  })
                : buildDefaultLifecycleStates(row.id, timestamp);
            await db.workspace.replaceLifecycleStates(row.id, lifecycleStates);
            await db.workspace.replaceProjectEntityTypes(
              row.id,
              buildDefaultProjectEntityTypes(row.id, timestamp)
            );
            await db.workspace.replaceTeams(
              row.id,
              srcTeams.map(t => {
                const id = randomUUID();
                teamMap.set(t.id, id);
                return { ...t, id, workspace: row.id, created_at: timestamp };
              })
            );
            for (const role of srcRoles) {
              await db.workspace.createCustomWorkspaceRole({
                ...role,
                id: randomUUID(),
                workspace: row.id,
                created_at: timestamp,
                updated_at: timestamp
              });
            }
          } else {
            await db.workspace.replaceLifecycleStates(
              row.id,
              buildDefaultLifecycleStates(row.id, timestamp)
            );
            await db.workspace.replaceProjectEntityTypes(
              row.id,
              buildDefaultProjectEntityTypes(row.id, timestamp)
            );
            await db.workspace.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));
          }

          const schemaMap = new Map<string, string>();
          const documentTypeMap = new Map<string, string>();
          if (includeSet.has('schemas')) {
            for (const schema of srcSchemas) schemaMap.set(schema.id, randomUUID());
            const sharedFieldGroupMap = new Map<string, string>();
            for (const group of srcSharedFieldGroups)
              sharedFieldGroupMap.set(group.id, randomUUID());
            for (const group of srcSharedFieldGroups) {
              await db.catalog.createSharedFieldGroup({
                ...group,
                id: sharedFieldGroupMap.get(group.id)!,
                workspace: row.id,
                created_at: timestamp,
                updated_at: timestamp
              });
            }
            for (const schema of srcSchemas) {
              const remappedFields = schema.fields.map(field => {
                if (field.groupId && sharedFieldGroupMap.has(field.groupId)) {
                  return { ...field, groupId: sharedFieldGroupMap.get(field.groupId)! };
                }
                if (isReferenceOrContainmentField(field)) {
                  return { ...field, schemaId: schemaMap.get(field.schemaId) ?? field.schemaId };
                }
                return field;
              });
              const remappedGroups = (schema.groups ?? []).map(group => ({
                ...group,
                id: sharedFieldGroupMap.get(group.id) ?? group.id,
                accessControl: group.accessControl
                  ? {
                      teamIds: group.accessControl.teamIds.map(id => teamMap.get(id) ?? id)
                    }
                  : undefined
              }));
              const remappedSharedLinks = (schema.shared_field_group_links ?? []).map(link => ({
                ...link,
                groupId: sharedFieldGroupMap.get(link.groupId) ?? link.groupId,
                teamIds: link.teamIds?.map(id => teamMap.get(id) ?? id)
              }));
              const relationshipFieldIds = new Set(
                schema.fields.filter(isReferenceOrContainmentField).map(field => field.id)
              );
              const templates = (schema.templates ?? []).map(template => {
                const templateFields = Object.fromEntries(
                  Object.entries(template.values.fields).filter(
                    ([fieldId]) => !relationshipFieldIds.has(fieldId)
                  )
                );
                return {
                  ...template,
                  values: {
                    ...template.values,
                    fields: templateFields,
                    owner: template.values.owner
                      ? (teamMap.get(template.values.owner) ?? undefined)
                      : undefined,
                    lifecycle: template.values.lifecycle
                      ? (lifecycleMap.get(template.values.lifecycle) ?? undefined)
                      : undefined
                  }
                };
              });
              const keyPrefix = generateCopiedSchemaKeyPrefix(`${row.id}:${schema.id}`);
              await db.catalog.createSchema({
                id: schemaMap.get(schema.id)!,
                workspace: row.id,
                name: schema.name,
                category: schema.category ?? null,
                description: schema.description,
                key_prefix: keyPrefix,
                color: schema.color,
                icon: schema.icon,
                fields: remappedFields,
                templates,
                groups: remappedGroups,
                shared_field_group_links: remappedSharedLinks,
                default_owner: schema.default_owner
                  ? (teamMap.get(schema.default_owner) ?? null)
                  : null,
                created_at: timestamp,
                updated_at: timestamp
              });
              if (schema.key_prefix) {
                await db.workspace.registerPublicIdPrefix(
                  keyPrefix,
                  'schema',
                  schemaMap.get(schema.id)!,
                  timestamp
                );
              }
            }

            for (const config of srcGovernanceConfigs) {
              if (
                config.case_kind !== ENTITY_CHANGE_POLICY_CASE_KIND &&
                config.case_kind !== ENTITY_DEPRECATION_POLICY_CASE_KIND &&
                config.case_kind !== FIELD_DATE_REMINDER_CASE_KIND
              ) {
                continue;
              }
              const caseSubkind = remappedCloneGovernanceSubkind(
                config.case_kind,
                config.case_subkind,
                schemaMap
              );
              if (caseSubkind === undefined) continue;
              await db.governanceCaseConfig.upsertCaseConfig({
                workspace: row.id,
                case_kind: config.case_kind,
                case_subkind: caseSubkind,
                enabled: config.enabled,
                config: remapGovernanceConfigTeams(config.config, teamMap),
                updated_at: timestamp,
                updated_by: null
              });
            }
          }
          if (
            includeSet.has('projects') ||
            includeSet.has('entities') ||
            includeSet.has('documents')
          ) {
            const projectMap = new Map<string, string>();
            if (includeSet.has('projects')) {
              for (const project of await db.project.listProjects(replicate_from)) {
                const id = randomUUID();
                projectMap.set(project.id, id);
                const publicId = formatPublicId(
                  row.short_code,
                  await db.workspace.allocatePublicId(row.short_code, timestamp)
                );
                await db.project.createProject({
                  id,
                  workspace: row.id,
                  public_id: publicId,
                  name: project.name,
                  description: project.description,
                  owner: project.owner ? (teamMap.get(project.owner) ?? null) : null,
                  status: project.status,
                  color: project.color,
                  start_date: project.start_date,
                  target_date: project.target_date,
                  pinned: project.pinned,
                  created_at: timestamp,
                  updated_at: timestamp
                });
              }
            }
            const entityMap = new Map<string, string>();
            if (includeSet.has('entities') && includeSet.has('schemas')) {
              const currencyConfig = await db.workspace.getSupportedCurrencies(row.id);
              const supportedCurrencies = new Set(
                currencyConfig.currencies.map(currency => currency.code)
              );
              const sourceEntities = await db.catalog.listEntities(replicate_from);
              for (const entity of sourceEntities) {
                const schemaId = schemaMap.get(entity.schema_id);
                if (!schemaId) continue;
                entityMap.set(entity.id, randomUUID());
              }
              for (const entity of sourceEntities) {
                const schemaId = schemaMap.get(entity.schema_id);
                const id = entityMap.get(entity.id);
                if (!schemaId || !id) continue;
                const sourceSchema = srcSchemas.find(schema => schema.id === entity.schema_id);
                const targetSchema = await db.catalog.getSchema(row.id, schemaId);
                if (!targetSchema) continue;
                const data = { ...entity.data };
                for (const field of sourceSchema?.fields ?? []) {
                  if (field.type !== 'reference' && field.type !== 'containment') continue;
                  const raw = data[field.id];
                  const linked = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
                  const mapped = linked
                    .map(targetId => entityMap.get(targetId))
                    .filter((targetId): targetId is string => !!targetId);
                  data[field.id] = Array.isArray(raw) ? mapped : (mapped[0] ?? null);
                }
                const normalizedData = normalizeEntityScalarFields({
                  schemaFields: targetSchema.fields,
                  fields: data,
                  supportedCurrencies
                });
                const mappedOwner = entity.owner ? (teamMap.get(entity.owner) ?? null) : null;
                const mappedLifecycle = entity.lifecycle
                  ? (lifecycleMap.get(entity.lifecycle) ?? null)
                  : null;
                await db.catalog.createEntity({
                  ...entity,
                  id,
                  workspace: row.id,
                  public_id: formatPublicId(
                    targetSchema.key_prefix,
                    await db.workspace.allocatePublicId(targetSchema.key_prefix, timestamp)
                  ),
                  slug: `${entity.slug}-${id.slice(0, 8)}`,
                  schema_id: schemaId,
                  owner: mappedOwner,
                  lifecycle: mappedLifecycle,
                  target_lifecycle: entity.target_lifecycle
                    ? (lifecycleMap.get(entity.target_lifecycle) ?? null)
                    : null,
                  data: normalizedData,
                  created_at: timestamp,
                  updated_at: timestamp,
                  // Owner/lifecycle mapping can drop a value to null if the target workspace has no
                  // equivalent, so recompute rather than carry the source workspace's score forward.
                  completeness: computeEntityCompleteness(
                    {
                      description: entity.description,
                      owner: mappedOwner,
                      lifecycle: mappedLifecycle,
                      data: normalizedData
                    },
                    targetSchema
                  )
                });
              }
            }

            if (includeSet.has('documents')) {
              const sourceTypes = await db.document.listDocumentTypes(replicate_from, true);
              for (const type of sourceTypes) documentTypeMap.set(type.id, randomUUID());
              const typeMap = documentTypeMap;
              for (const type of sourceTypes) {
                await db.document.createDocumentType({
                  ...type,
                  id: typeMap.get(type.id)!,
                  workspace: row.id,
                  created_at: timestamp,
                  updated_at: timestamp
                });
                if (type.archived)
                  await db.document.archiveDocumentType(
                    row.id,
                    typeMap.get(type.id)!,
                    true,
                    timestamp
                  );
              }
              for (const config of await db.governanceCaseConfig.listCaseConfigForKind(
                replicate_from,
                DOCUMENT_STATUS_CASE_KIND
              )) {
                const separator = config.case_subkind?.indexOf(':') ?? -1;
                if (separator <= 0) continue;
                const targetTypeId = typeMap.get(config.case_subkind!.slice(0, separator));
                if (!targetTypeId) continue;
                await db.governanceCaseConfig.upsertCaseConfig({
                  workspace: row.id,
                  case_kind: config.case_kind,
                  case_subkind: encodeCaseSubkind(
                    targetTypeId,
                    config.case_subkind!.slice(separator + 1)
                  ),
                  enabled: config.enabled,
                  config: config.config,
                  updated_at: timestamp,
                  updated_by: null
                });
              }
              const { nodeMap, sourceEntityIdByIdentifier } = await copyTypedWorkspaceDocuments(
                db,
                storage,
                replicate_from,
                row.id,
                typeMap,
                projectMap,
                entityMap,
                timestamp
              );
              for (const template of await db.document.listDocumentTemplates(
                replicate_from,
                undefined,
                true
              )) {
                const projectId =
                  template.project_id == null ? null : projectMap.get(template.project_id);
                if (template.project_id != null && !projectId) continue;
                const documentTypeId = typeMap.get(template.document_type_id);
                const sourceType = sourceTypes.find(type => type.id === template.document_type_id);
                if (!documentTypeId) continue;
                const copiedTemplate = await db.document.createDocumentTemplate({
                  ...template,
                  id: randomUUID(),
                  workspace: row.id,
                  project_id: projectId ?? null,
                  document_type_id: documentTypeId,
                  metadata_defaults: sourceType
                    ? remapDocumentMetadataValues(
                        sourceType.fields,
                        template.metadata_defaults,
                        id => entityMap.get(sourceEntityIdByIdentifier.get(id) ?? id),
                        id => nodeMap.get(id)
                      )
                    : template.metadata_defaults,
                  created_at: timestamp,
                  updated_at: timestamp
                });
                if (template.archived)
                  await db.document.archiveDocumentTemplate(
                    row.id,
                    copiedTemplate.id,
                    true,
                    timestamp
                  );
              }
            }
          }

          if (includeSet.has('settings')) {
            for (const configuration of srcCapabilityConfigurations) {
              const remappedEntries = Object.entries(configuration.bindings).flatMap(
                ([bindingId, binding]) => {
                  const targetMap =
                    binding.target.kind === 'entity_schema'
                      ? schemaMap
                      : binding.target.kind === 'document_type'
                        ? documentTypeMap
                        : null;
                  const targetId = targetMap?.get(binding.target.id);
                  return targetId
                    ? [
                        [
                          bindingId,
                          {
                            ...binding,
                            target: { ...binding.target, id: targetId }
                          }
                        ] as const
                      ]
                    : [];
                }
              );
              if (remappedEntries.length !== Object.keys(configuration.bindings).length) continue;
              await db.workspace.upsertWorkspaceCapabilityConfiguration({
                id: randomUUID(),
                workspace: row.id,
                type: configuration.type,
                bindings: Object.fromEntries(remappedEntries) as WorkspaceCapabilityBindings,
                created_at: timestamp,
                updated_at: timestamp
              });
            }
          }
        } else {
          await db.workspace.replaceLifecycleStates(
            row.id,
            buildDefaultLifecycleStates(row.id, timestamp)
          );
          await db.workspace.replaceProjectEntityTypes(
            row.id,
            buildDefaultProjectEntityTypes(row.id, timestamp)
          );
          await db.workspace.replaceTeams(row.id, buildDefaultWorkspaceTeams(row.id, timestamp));

          if (typeof template === 'string' && template && template !== 'blank') {
            const definitions = instantiateTemplateDefinitions(row.id, template, timestamp);
            for (const enumeration of definitions.enums) {
              await db.catalog.createEnum(enumeration);
            }
            for (const fieldGroup of definitions.fieldGroups) {
              await db.catalog.createSharedFieldGroup(fieldGroup);
            }
            for (const schema of definitions.schemas) {
              await db.catalog.createSchema(schema);
              if (schema.key_prefix) {
                await db.workspace.registerPublicIdPrefix(
                  schema.key_prefix,
                  'schema',
                  schema.id,
                  timestamp
                );
              }
            }
            for (const relationSchema of definitions.relationSchemas) {
              await db.relation.createRelationSchema(relationSchema);
            }
            for (const documentType of definitions.documentTypes) {
              await db.document.createDocumentType(documentType);
            }
            for (const documentTemplate of definitions.documentTemplates) {
              await db.document.createDocumentTemplate(documentTemplate);
            }
            for (const configuration of definitions.capabilityConfigurations) {
              await db.workspace.upsertWorkspaceCapabilityConfiguration({
                id: randomUUID(),
                workspace: row.id,
                type: configuration.type,
                bindings: configuration.bindings,
                created_at: timestamp,
                updated_at: timestamp
              });
            }
            if (definitions.dashboardWidgets.length > 0) {
              await replaceDefaultWorkspaceDashboardLayout(
                db,
                row.id,
                definitions.dashboardWidgets,
                authCtx.userId
              );
            }
          }
        }

        await db.ai.upsertAiConfig(row.id, { enabled: false });

        await logAudit(db, {
          userId: authCtx.userId,
          workspace: row.id,
          operation: 'create',
          entityType: 'workspace',
          entityId: row.id,
          entityName: row.name,
          changes: { new: extractEntityFields(row) }
        });

        return toApiWorkspace(row);
      } catch (error) {
        await db.workspace.deleteWorkspace(row.id).catch(() => undefined);
        throw error;
      }
    }
  });
};

export const updateWorkspace = async (
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    description?: string;
    url_slug?: string;
    short_code?: string;
    color?: string;
  },
  event: AuthenticatedEvent
): Promise<Workspace> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'global' },
    fallback: 'Failed to update workspace',
    dbErrorMessages: { unique: 'A workspace with that name already exists' },
    operation: async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const oldRow = await db.workspace.getWorkspace(id);
      if (oldRow == null)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Workspace '${id}' not found`
        });

      const updatedAt = new Date();
      const updateInput = buildUpdateInput(input, oldRow, updatedAt);
      const row = await db.workspace.updateWorkspace(id, updateInput);
      if (row == null)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Workspace '${id}' not found`
        });

      if (oldRow.short_code !== row.short_code) {
        await db.workspace.updatePublicIdPrefix(
          oldRow.short_code,
          row.short_code,
          'workspace',
          row.id,
          updatedAt
        );
      }

      const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row));
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: id,
        operation: 'update',
        entityType: 'workspace',
        entityId: id,
        entityName: row.name,
        changes
      });

      return toApiWorkspace(row);
    }
  });
};

export const deleteWorkspace = async (
  db: DatabaseAdapter,
  id: string,
  event: AuthenticatedEvent,
  storage?: StorageAdapter
): Promise<{ success: boolean; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'global' },
    fallback: 'Failed to delete workspace',
    dbErrorMessages: { unique: 'A workspace with that name already exists' },
    operation: async ({ authCtx }) => {
      requireGlobalPermission(authCtx, 'admin_platform');
      const { workspace, projectIds } = await db.workspace.deleteWorkspace(id);
      if (workspace == null)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Workspace '${id}' not found`
        });

      if (storage) {
        await Promise.all(
          projectIds.map(projectId =>
            storage.deleteAll(id, projectId).catch(error => {
              logger.error('Workspace project storage cleanup failed', {
                workspace: id,
                projectId,
                error: error instanceof Error ? error.message : String(error)
              });
            })
          )
        );
      }

      return { success: true, message: `Workspace '${workspace.name}' deleted` };
    }
  });
};
