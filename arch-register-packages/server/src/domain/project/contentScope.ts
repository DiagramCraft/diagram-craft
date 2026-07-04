import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { requireProjectAction } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { ContentNodeDbResult } from './db/projectDatabase';

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
  /** written to content_node.entity_id */
  readonly entityId: string | null;
  /** merged into logAudit(...).metadata alongside path/is_folder/etc. */
  readonly auditMetadata: Record<string, string>;

  listNodes(db: DatabaseAdapter, ws: string): Promise<ContentNodeDbResult[]>;
  findNodeByPath(db: DatabaseAdapter, ws: string, path: string): Promise<ContentNodeDbResult | null>;
  deleteNodeByPath(db: DatabaseAdapter, ws: string, path: string): Promise<ContentNodeDbResult | null>;
  deleteNodeFolder(db: DatabaseAdapter, ws: string, folderPath: string): Promise<ContentNodeDbResult[]>;
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
   * NOTE: today only the project scope enforces an explicit ownership/permission
   * check (via requireProjectAction); entity and workspace scopes perform no
   * equivalent check. This is a known gap tracked in issue #1966 and preserved
   * here as-is rather than silently unified.
   */
  resolve(
    db: DatabaseAdapter,
    ws: string,
    identifier: string | undefined,
    authCtx: AuthorizationContext,
    action: ContentAction
  ): Promise<ResolvedContentScope>;
}

export const PROJECT_SCOPE: ContentScopeResolver = {
  kind: 'project',
  resolve: async (db, ws, identifier, authCtx, action) => {
    const project = await db.project.getProject(ws, identifier!);
    httpAssert.present(project, { status: 404, message: `Project '${identifier}' not found` });

    if (action === 'edit') {
      requireProjectAction(
        authCtx,
        project.owner,
        'edit_project',
        'You do not have permission to modify this project'
      );
    }

    const projectId = project.id;
    return {
      kind: 'project',
      storageId: projectId,
      projectId,
      entityId: null,
      auditMetadata: { project_id: projectId },
      listNodes: (db, ws) => db.project.listContentNodes(ws, projectId),
      findNodeByPath: (db, ws, path) => db.project.getContentNodeByPath(ws, projectId, path),
      deleteNodeByPath: (db, ws, path) => db.project.deleteContentNodeByPath(ws, projectId, path),
      deleteNodeFolder: (db, ws, folderPath) => db.project.deleteContentNodeFolder(ws, projectId, folderPath),
      renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
        db.project.renameContentNodeFolder(ws, projectId, oldPath, newPath, updatedAt)
    };
  }
};

export const ENTITY_SCOPE: ContentScopeResolver = {
  kind: 'entity',
  resolve: async (db, ws, identifier, _authCtx, _action) => {
    const entity = await db.catalog.getEntity(ws, identifier!);
    httpAssert.present(entity, { status: 404, message: `Entity '${identifier}' not found` });

    const entityId = entity.id;
    return {
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
      deleteNodeFolder: (db, ws, folderPath) => db.project.deleteEntityContentNodeFolder(ws, entityId, folderPath),
      renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
        db.project.renameEntityContentNodeFolder(ws, entityId, oldPath, newPath, updatedAt)
    };
  }
};

export const WORKSPACE_SCOPE: ContentScopeResolver = {
  kind: 'workspace',
  resolve: async (_db, ws, _identifier, _authCtx, _action) => {
    return {
      kind: 'workspace',
      storageId: ws,
      projectId: null,
      entityId: null,
      auditMetadata: {},
      listNodes: (db, ws) => db.project.listWorkspaceContentNodes(ws),
      findNodeByPath: async (db, ws, path) => {
        const nodes = await db.project.listWorkspaceContentNodes(ws);
        return nodes.find(n => n.path === path) ?? null;
      },
      deleteNodeByPath: (db, ws, path) => db.project.deleteWorkspaceContentNodeByPath(ws, path),
      deleteNodeFolder: (db, ws, folderPath) => db.project.deleteWorkspaceContentNodeFolder(ws, folderPath),
      renameNodeFolder: (db, ws, oldPath, newPath, updatedAt) =>
        db.project.renameWorkspaceContentNodeFolder(ws, oldPath, newPath, updatedAt)
    };
  }
};
