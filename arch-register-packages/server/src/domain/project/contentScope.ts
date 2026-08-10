import type { DatabaseAdapter } from '../../db/database';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { requireNonProjectContentAccess } from './projectOperationHelpers';

export type ScopeKind = 'project' | 'entity' | 'workspace';

export type ContentAction = 'read' | 'edit';

/**
 * A content scope resolved to a concrete project/entity/workspace, exposing the
 * scope-specific DB operations needed by generic content operations. This wraps
 * the existing per-scope DB methods (which differ in name, and in some cases
 * between a point query and a list+find) without changing their behavior.
 */
export interface ResolvedContentScope {
  readonly kind: ScopeKind;
  /** id passed to storage.read/write/delete */
  readonly storageId: string;
  /** written to content_node.project_id */
  readonly projectId: string | null;
  /** public project identifier used by API metadata responses */
  readonly projectPublicId?: string;
  /** written to content_node.entity_id */
  readonly entityId: string | null;
  /** merged into logAudit(...).metadata alongside path/is_folder/etc. */
  readonly auditMetadata: Record<string, string>;

  listNodes(db: DatabaseAdapter, ws: string): Promise<ContentNodeDbResult[]>;
  findNodeByPath(
    db: DatabaseAdapter,
    ws: string,
    path: string
  ): Promise<ContentNodeDbResult | null>;
  deleteNodeByPath(
    db: DatabaseAdapter,
    ws: string,
    path: string
  ): Promise<ContentNodeDbResult | null>;
  deleteNodeFolder(
    db: DatabaseAdapter,
    ws: string,
    folderPath: string
  ): Promise<ContentNodeDbResult[]>;
  renameNodeFolder(
    db: DatabaseAdapter,
    ws: string,
    oldPath: string,
    newPath: string,
    updatedAt: Date
  ): Promise<string[]>;
}

export interface ContentScopeResolver {
  readonly kind: ScopeKind;
  /**
   * Resolves the scope identifier (project/entity lookup, or a no-op for workspace)
   * and enforces authorization for the given action.
   *
   * Project content uses project authorization. Entity and workspace content
   * use the dedicated workspace-level content capabilities.
   */
  resolve(
    db: DatabaseAdapter,
    ws: string,
    identifier: string | undefined,
    authCtx: WorkspaceAuthorizationContext,
    action: ContentAction,
    authorize?: boolean
  ): Promise<ResolvedContentScope>;
}

export type ContentNodeScopeIdentity = Pick<ContentNodeDbResult, 'project_id' | 'entity_id'>;

/** Returns the scope-specific foreign-key fields for a content-node write. */
export const contentNodeScopeFields = (
  scope: Pick<ResolvedContentScope, 'projectId' | 'entityId'>
) => ({
  project_id: scope.projectId,
  entity_id: scope.entityId
});

/** Resolves a node's parent folder without duplicating path parsing at call sites. */
export const contentParentId = (
  nodes: readonly Pick<ContentNodeDbResult, 'id' | 'path' | 'type'>[],
  path: string
) => {
  const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
  if (!parentPath) return null;
  return nodes.find(node => node.path === parentPath && node.type === 'folder')?.id ?? null;
};

export const scopeResolverForContentNode = (
  node: ContentNodeScopeIdentity
): { scope: ContentScopeResolver; identifier: string | undefined } => {
  if (node.project_id) return { scope: PROJECT_SCOPE, identifier: node.project_id };
  if (node.entity_id) return { scope: ENTITY_SCOPE, identifier: node.entity_id };
  return { scope: WORKSPACE_SCOPE, identifier: undefined };
};

const requireNonProjectScopeAccess = (
  authCtx: WorkspaceAuthorizationContext,
  action: ContentAction
) => requireNonProjectContentAccess(authCtx, action);

const resolvedProjectScope = (
  projectId: string,
  projectPublicId: string | undefined
): ResolvedContentScope => ({
  kind: 'project',
  storageId: projectId,
  projectId,
  projectPublicId,
  entityId: null,
  auditMetadata: { project_id: projectId },
  listNodes: (db, ws) => db.project.listContentNodes(ws, projectId),
  findNodeByPath: (db, ws, path) => db.project.getContentNodeByPath(ws, projectId, path),
  deleteNodeByPath: (db, ws, path) => db.project.deleteContentNodeByPath(ws, projectId, path),
  deleteNodeFolder: (db, ws, folderPath) =>
    db.project.deleteContentNodeFolder(ws, projectId, folderPath),
  renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
    db.project.renameContentNodeFolder(ws, projectId, oldPath, newPath, updatedAt)
});

const resolvedEntityScope = (entityId: string): ResolvedContentScope => ({
  kind: 'entity',
  storageId: entityId,
  projectId: null,
  entityId,
  auditMetadata: { entity_id: entityId },
  listNodes: (db, ws) => db.project.listEntityContentNodes(ws, entityId),
  findNodeByPath: async (db, ws, path) => {
    const nodes = await db.project.listEntityContentNodes(ws, entityId);
    return nodes.find(n => n.path === path) ?? null;
  },
  deleteNodeByPath: (db, ws, path) => db.project.deleteEntityContentNodeByPath(ws, entityId, path),
  deleteNodeFolder: (db, ws, folderPath) =>
    db.project.deleteEntityContentNodeFolder(ws, entityId, folderPath),
  renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
    db.project.renameEntityContentNodeFolder(ws, entityId, oldPath, newPath, updatedAt)
});

const resolvedWorkspaceScope = (workspace: string): ResolvedContentScope => ({
  kind: 'workspace',
  storageId: workspace,
  projectId: null,
  entityId: null,
  auditMetadata: {},
  listNodes: (db, ws) => db.project.listWorkspaceContentNodes(ws),
  findNodeByPath: async (db, ws, path) => {
    const nodes = await db.project.listWorkspaceContentNodes(ws);
    return nodes.find(n => n.path === path) ?? null;
  },
  deleteNodeByPath: (db, ws, path) => db.project.deleteWorkspaceContentNodeByPath(ws, path),
  deleteNodeFolder: (db, ws, folderPath) =>
    db.project.deleteWorkspaceContentNodeFolder(ws, folderPath),
  renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
    db.project.renameWorkspaceContentNodeFolder(ws, oldPath, newPath, updatedAt)
});

/** Resolves and authorizes the scope owning an already-loaded content node. */
export const resolveContentScopeForNode = async (
  db: DatabaseAdapter,
  ws: string,
  authCtx: WorkspaceAuthorizationContext,
  node: ContentNodeScopeIdentity,
  action: ContentAction,
  authorize = true
) => {
  const { scope, identifier } = scopeResolverForContentNode(node);
  if (scope.kind === 'project') {
    return scope.resolve(db, ws, identifier, authCtx, action, authorize);
  }
  if (authorize) requireNonProjectScopeAccess(authCtx, action);
  return scope.kind === 'entity'
    ? resolvedEntityScope(node.entity_id!)
    : resolvedWorkspaceScope(ws);
};

export const PROJECT_SCOPE: ContentScopeResolver = {
  kind: 'project',
  resolve: async (db, ws, identifier, authCtx, action, authorize = true) => {
    const project = await db.project.getProject(ws, identifier!);
    httpAssert.present(project, { status: 404, message: `Project '${identifier}' not found` });

    if (!authorize) return resolvedProjectScope(project.id, project.public_id);

    if (action === 'edit') {
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to modify this project'
      );
    } else {
      requireProjectAccess(authCtx, project.owner);
    }

    return resolvedProjectScope(project.id, project.public_id);
  }
};

export const ENTITY_SCOPE: ContentScopeResolver = {
  kind: 'entity',
  resolve: async (db, ws, identifier, authCtx, action, authorize = true) => {
    if (authorize) {
      requireWorkspaceCapability(authCtx, action === 'read' ? 'content.view' : 'content.edit');
    }
    const entity = await db.catalog.getEntity(ws, identifier!);
    httpAssert.present(entity, { status: 404, message: `Entity '${identifier}' not found` });

    return resolvedEntityScope(entity.id);
  }
};

export const WORKSPACE_SCOPE: ContentScopeResolver = {
  kind: 'workspace',
  resolve: async (_db, ws, _identifier, authCtx, action, authorize = true) => {
    if (authorize) {
      requireWorkspaceCapability(authCtx, action === 'read' ? 'content.view' : 'content.edit');
    }
    return resolvedWorkspaceScope(ws);
  }
};
