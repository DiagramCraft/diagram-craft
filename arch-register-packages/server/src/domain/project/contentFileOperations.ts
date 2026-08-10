import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';
import { getDiagramCommentCounts } from '../diagram/commentCounts';
import { getDiagramEntityRefs } from '../diagram/diagramEntityRefs';
import { buildApiAuthCtx } from '../auth/authorization';
import { writeAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import {
  fileNameFromPath,
  displayNameFromBody,
  folderFromPath,
  stripJsonExtension
} from './contentFileHelpers';
import {
  collectDescendantNodes,
  getAttachmentContainerForMarkdownNode
} from './contentNodeRoleUtils';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { HTTPError } from 'h3';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';

import {
  contentNodeScopeFields,
  contentParentId,
  ENTITY_SCOPE,
  PROJECT_SCOPE,
  resolveContentScopeForNode,
  WORKSPACE_SCOPE
} from './contentScope';
import type { ContentScopeResolver } from './contentScope';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { coordinateContentWrite } from './contentWriteCoordinator';
import {
  projectDbErrorMessages,
  reloadContentNode,
  syncDiagramContentMetadata,
  requireNonProjectContentAccess,
  assertContentPathWritable,
  assertContentNodeWritable
} from './projectOperationHelpers';

const getNodeExtension = (node: Pick<ContentNodeDbResult, 'type'>) => {
  switch (node.type) {
    case 'markdown':
      return '.md';
    case 'file':
      return '';
    default:
      return '.json';
  }
};

const getDisplayNameForPath = (node: Pick<ContentNodeDbResult, 'type'>, path: string) => {
  const fileName = fileNameFromPath(path);
  if (node.type === 'file') return fileName;
  if (node.type === 'markdown' && fileName.endsWith('.md')) return fileName.slice(0, -3);
  if (fileName.endsWith('.json')) return fileName.slice(0, -5);
  return fileName;
};

const buildRelocatedAttachmentPath = (
  previousRootPath: string,
  nextRootPath: string,
  currentPath: string
) => {
  if (currentPath === previousRootPath) return nextRootPath;
  const suffix = currentPath.startsWith(`${previousRootPath}/`)
    ? currentPath.slice(previousRootPath.length + 1)
    : currentPath;
  return `${nextRootPath}/${suffix}`;
};

const writeScopedDiagram = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  assertContentPathWritable(nodes, filePath);
  const existing = nodes.find(node => node.path === filePath && node.type === 'diagram');
  const content = Buffer.from(JSON.stringify(body));
  const doc = body as unknown as SerializedDiagramDocument;
  const timestamp = new Date();
  const counts = getDiagramCommentCounts(doc);
  const nodeId = existing?.id ?? randomUUID();
  let saved!: ContentNodeDbResult;

  await coordinateContentWrite({
    db,
    storage,
    operation: existing ? 'update' : 'create',
    scope: resolved.kind,
    nodeIds: [nodeId],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId,
        content
      }
    ],
    writeDatabase: async tx => {
      await tx.project.upsertContentNode({
        id: nodeId,
        workspace: ws,
        ...contentNodeScopeFields(resolved),
        parent_id: contentParentId(nodes, filePath),
        path: filePath,
        name: displayNameFromBody(body, filePath),
        size_bytes: content.length,
        comment_count: counts.commentCount,
        unresolved_comment_count: counts.unresolvedCommentCount,
        created_atIfNew: existing?.created_at ?? timestamp,
        updated_at: timestamp,
        created_byIfNew: existing?.created_by ?? authCtx.userId,
        updated_by: authCtx.userId
      });
      await syncDiagramContentMetadata(tx, ws, nodeId, doc, timestamp);
      saved = await reloadContentNode(tx, ws, nodeId);
    },
    afterCommit: [
      {
        name: 'preview',
        run: async () => {
          const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
          const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
          const preview =
            (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc) ?? null;
          if (resolved.kind === 'workspace') {
            await db.project.updateWorkspaceContentNodeDerivedData(
              ws,
              nodeId,
              content.length,
              counts.commentCount,
              counts.unresolvedCommentCount,
              preview,
              timestamp
            );
          } else {
            await db.project.updateContentNodePreview(ws, resolved.storageId, nodeId, preview);
          }
        }
      },
      {
        name: 'references',
        run: () => db.project.syncDiagramEntityRefs(ws, nodeId, getDiagramEntityRefs(doc))
      },
      {
        name: 'audit',
        run: tx =>
          writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: existing ? 'update' : 'create',
            entityType: 'content_node',
            entityId: nodeId,
            entityName: saved.name,
            changes: existing
              ? computeChanges(extractEntityFields(existing), extractEntityFields(saved))
              : { new: extractEntityFields(saved) },
            metadata: { ...resolved.auditMetadata, path: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
};

export const createEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return writeScopedDiagram(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, body, event);
};

const resolveLegacyContentScope = async (
  db: DatabaseAdapter,
  ws: string,
  identifier: string
): Promise<ContentScopeResolver> => {
  return (await db.project.getProject(ws, identifier)) ? PROJECT_SCOPE : ENTITY_SCOPE;
};

type ContentScopeSelection =
  | ContentScopeResolver
  | ((db: DatabaseAdapter, ws: string) => Promise<ContentScopeResolver>);

const readScopedDiagram = async (
  scopeSelection: ContentScopeSelection,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  event: AuthenticatedEvent,
  fallback: string
): Promise<Record<string, unknown>> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: fallback,
    dbErrorMessages: projectDbErrorMessages,
    onError: error => {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'ENOENT'
      ) {
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `File '${filePath}' not found`
        });
      }
    },
    operation: async ({ ws, authCtx }) => {
      const scope =
        typeof scopeSelection === 'function' ? await scopeSelection(db, ws) : scopeSelection;
      if (scope.kind !== 'project') requireNonProjectContentAccess(authCtx, 'read');
      const resolved = await scope.resolve(
        db,
        ws,
        identifier,
        authCtx,
        'read',
        scope.kind === 'project'
      );
      const file = await resolved.findNodeByPath(db, ws, filePath);
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
      httpAssert.true(file.type === 'diagram', {
        status: 400,
        message: 'Node is not a diagram file'
      });

      const content = await storage.read(ws, resolved.storageId, file.id);
      return JSON.parse(content.toString('utf8'));
    }
  });

export const getFileContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  return readScopedDiagram(
    (scopeDb, ws) => resolveLegacyContentScope(scopeDb, ws, id),
    db,
    storage,
    workspace,
    id,
    filePath,
    event,
    'Failed to read file'
  );
};

export const saveFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to write file',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws }) => {
      const scope = await resolveLegacyContentScope(db, ws, id);
      return writeScopedDiagram(scope, db, storage, workspace, id, filePath, body, event);
    }
  });
};

export const cloneContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const source = nodes.find(node => node.path === filePath);
  httpAssert.present(source, { status: 404, message: `File '${filePath}' not found` });
  const baseName = fileNameFromPath(filePath);
  const folder = folderFromPath(filePath);
  const extension = getNodeExtension(source);
  const stem =
    source.type === 'file'
      ? baseName
      : source.type === 'markdown' && baseName.endsWith('.md')
        ? baseName.slice(0, -3)
        : stripJsonExtension(baseName);
  let cloneName = '';
  let clonePath = '';
  for (let number = 1; number < 1000; number++) {
    cloneName = `${stem} (${number})`;
    clonePath = folder ? `${folder}/${cloneName}${extension}` : `${cloneName}${extension}`;
    if (!nodes.some(node => node.path === clonePath)) break;
  }
  assertContentPathWritable(nodes, clonePath);

  const timestamp = new Date();
  const rootId = randomUUID();
  const sourceContent = await storage.read(ws, resolved.storageId, source.id);
  let rootContent = sourceContent;
  let doc: SerializedDiagramDocument | undefined;
  let commentCounts = {
    commentCount: source.comment_count,
    unresolvedCommentCount: source.unresolved_comment_count
  };
  if (source.type === 'diagram') {
    const parsed = JSON.parse(sourceContent.toString('utf8'));
    if (parsed && typeof parsed === 'object' && 'name' in parsed) parsed.name = cloneName;
    doc = parsed as SerializedDiagramDocument;
    rootContent = Buffer.from(JSON.stringify(parsed));
    commentCounts = getDiagramCommentCounts(doc);
  }

  const container =
    source.type === 'markdown'
      ? getAttachmentContainerForMarkdownNode(nodes, source.id)
      : undefined;
  const attachmentSources = container
    ? [container, ...collectDescendantNodes(nodes, container.id)]
    : [];
  const idMap = new Map<string, string>([[source.id, rootId]]);
  for (const node of attachmentSources) idMap.set(node.id, randomUUID());
  const attachmentContents = new Map<string, Buffer>();
  for (const node of attachmentSources) {
    if (node.type !== 'folder') {
      attachmentContents.set(node.id, await storage.read(ws, resolved.storageId, node.id));
    }
  }

  let saved!: ContentNodeDbResult;
  const storageChanges = [
    {
      type: 'write' as const,
      workspace: ws,
      storageId: resolved.storageId,
      nodeId: rootId,
      content: rootContent
    },
    ...attachmentSources
      .filter(node => node.type !== 'folder')
      .map(node => ({
        type: 'write' as const,
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: idMap.get(node.id)!,
        content: attachmentContents.get(node.id)!
      }))
  ];
  await coordinateContentWrite({
    db,
    storage,
    operation: 'clone',
    scope: resolved.kind,
    nodeIds: [rootId, ...attachmentSources.map(node => idMap.get(node.id)!)],
    storageChanges,
    writeDatabase: async tx => {
      saved = await tx.project.upsertContentNode({
        id: rootId,
        workspace: ws,
        ...contentNodeScopeFields(resolved),
        parent_id: source.parent_id,
        path: clonePath,
        name: cloneName,
        role: source.role,
        type: source.type,
        size_bytes: rootContent.length,
        comment_count: commentCounts.commentCount,
        unresolved_comment_count: commentCounts.unresolvedCommentCount,
        created_atIfNew: timestamp,
        updated_at: timestamp,
        created_byIfNew: authCtx.userId,
        updated_by: authCtx.userId,
        mime_type: source.mime_type,
        original_filename: source.type === 'file' ? cloneName : source.original_filename
      });
      const oldRoot = source.path.endsWith('.md') ? source.path.slice(0, -3) : source.path;
      const newRoot = clonePath.endsWith('.md') ? clonePath.slice(0, -3) : clonePath;
      for (const node of attachmentSources) {
        await tx.project.upsertContentNode({
          id: idMap.get(node.id)!,
          workspace: ws,
          ...contentNodeScopeFields(resolved),
          parent_id:
            node.parent_id === source.id ? rootId : (idMap.get(node.parent_id ?? '') ?? null),
          path: buildRelocatedAttachmentPath(oldRoot, newRoot, node.path),
          name: node.name,
          role: node.role,
          type: node.type,
          size_bytes: node.size_bytes,
          comment_count: node.comment_count,
          unresolved_comment_count: node.unresolved_comment_count,
          created_atIfNew: timestamp,
          updated_at: timestamp,
          created_byIfNew: authCtx.userId,
          updated_by: authCtx.userId,
          mime_type: node.mime_type,
          original_filename: node.original_filename
        });
      }
      if (doc) await syncDiagramContentMetadata(tx, ws, rootId, doc, timestamp);
      saved = await reloadContentNode(tx, ws, rootId);
    },
    afterCommit: [
      ...(doc
        ? [
            {
              name: 'preview' as const,
              run: async () => {
                const { generateAccurateSvgPreview } = await import(
                  '../diagram/serverDiagramRenderer'
                );
                const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
                const preview =
                  (await generateAccurateSvgPreview(doc!)) ?? generateSvgPreview(doc!) ?? null;
                if (resolved.kind === 'workspace') {
                  await db.project.updateWorkspaceContentNodeDerivedData(
                    ws,
                    rootId,
                    rootContent.length,
                    commentCounts.commentCount,
                    commentCounts.unresolvedCommentCount,
                    preview,
                    timestamp
                  );
                } else {
                  await db.project.updateContentNodePreview(
                    ws,
                    resolved.storageId,
                    rootId,
                    preview
                  );
                }
              }
            }
          ]
        : []),
      ...(doc
        ? [
            {
              name: 'references' as const,
              run: () => db.project.syncDiagramEntityRefs(ws, rootId, getDiagramEntityRefs(doc!))
            }
          ]
        : []),
      {
        name: 'audit',
        run: tx =>
          writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'create',
            entityType: 'content_node',
            entityId: rootId,
            entityName: saved.name,
            changes: { new: extractEntityFields(saved) },
            metadata: { ...resolved.auditMetadata, path: clonePath, cloned_from: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
};

export const relocateContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  const source = nodes.find(node => node.path === filePath);
  httpAssert.present(source, { status: 404, message: `File '${filePath}' not found` });
  if (filePath === newPath) return toApiProjectFile(source);
  assertContentNodeWritable(source);
  assertContentPathWritable(nodes, newPath);
  httpAssert.true(!nodes.some(node => node.path === newPath), {
    status: 409,
    message: `A file already exists at '${newPath}'`
  });
  const displayName = getDisplayNameForPath(source, newPath);
  const parentId = contentParentId(nodes, newPath);
  const timestamp = new Date();
  const rootId = randomUUID();
  const sourceContent = await storage.read(ws, resolved.storageId, source.id);
  let rootContent = sourceContent;
  let doc: SerializedDiagramDocument | undefined;
  let counts = {
    commentCount: source.comment_count,
    unresolvedCommentCount: source.unresolved_comment_count
  };
  if (source.type === 'diagram') {
    const parsed = JSON.parse(sourceContent.toString('utf8'));
    if (parsed && typeof parsed === 'object' && 'name' in parsed) parsed.name = displayName;
    doc = parsed as SerializedDiagramDocument;
    rootContent = Buffer.from(JSON.stringify(parsed));
    counts = getDiagramCommentCounts(doc);
  }
  const container =
    source.type === 'markdown'
      ? getAttachmentContainerForMarkdownNode(nodes, source.id)
      : undefined;
  const attachmentSources = container
    ? [container, ...collectDescendantNodes(nodes, container.id)]
    : [];
  const idMap = new Map<string, string>([[source.id, rootId]]);
  for (const node of attachmentSources) idMap.set(node.id, randomUUID());
  const attachmentContents = new Map<string, Buffer>();
  for (const node of attachmentSources) {
    if (node.type !== 'folder') {
      attachmentContents.set(node.id, await storage.read(ws, resolved.storageId, node.id));
    }
  }
  const oldBlobs = [source, ...attachmentSources].filter(node => node.type !== 'folder');
  let saved!: ContentNodeDbResult;
  await coordinateContentWrite({
    db,
    storage,
    operation: 'move',
    scope: resolved.kind,
    nodeIds: [
      source.id,
      rootId,
      ...attachmentSources.flatMap(node => [node.id, idMap.get(node.id)!])
    ],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: rootId,
        content: rootContent
      },
      ...attachmentSources
        .filter(node => node.type !== 'folder')
        .map(node => ({
          type: 'write' as const,
          workspace: ws,
          storageId: resolved.storageId,
          nodeId: idMap.get(node.id)!,
          content: attachmentContents.get(node.id)!
        })),
      ...oldBlobs.map(node => ({
        type: 'delete' as const,
        workspace: ws,
        storageId: resolved.storageId,
        nodeId: node.id
      }))
    ],
    writeDatabase: async tx => {
      saved = await tx.project.upsertContentNode({
        id: rootId,
        workspace: ws,
        ...contentNodeScopeFields(resolved),
        parent_id: parentId,
        path: newPath,
        name: displayName,
        role: source.role,
        type: source.type,
        size_bytes: rootContent.length,
        comment_count: counts.commentCount,
        unresolved_comment_count: counts.unresolvedCommentCount,
        created_atIfNew: source.created_at,
        updated_at: timestamp,
        created_byIfNew: source.created_by,
        updated_by: authCtx.userId,
        mime_type: source.mime_type,
        original_filename: source.type === 'file' ? displayName : source.original_filename
      });
      const oldRoot = source.path.endsWith('.md') ? source.path.slice(0, -3) : source.path;
      const newRoot = newPath.endsWith('.md') ? newPath.slice(0, -3) : newPath;
      for (const node of attachmentSources) {
        await tx.project.upsertContentNode({
          id: idMap.get(node.id)!,
          workspace: ws,
          ...contentNodeScopeFields(resolved),
          parent_id:
            node.parent_id === source.id ? rootId : (idMap.get(node.parent_id ?? '') ?? null),
          path: buildRelocatedAttachmentPath(oldRoot, newRoot, node.path),
          name: node.name,
          role: node.role,
          type: node.type,
          size_bytes: node.size_bytes,
          comment_count: node.comment_count,
          unresolved_comment_count: node.unresolved_comment_count,
          created_atIfNew: node.created_at,
          updated_at: timestamp,
          created_byIfNew: node.created_by,
          updated_by: authCtx.userId,
          mime_type: node.mime_type,
          original_filename: node.original_filename
        });
      }
      if (doc) await syncDiagramContentMetadata(tx, ws, rootId, doc, timestamp);
      await resolved.deleteNodeByPath(tx, ws, filePath);
      saved = await reloadContentNode(tx, ws, rootId);
    },
    afterCommit: [
      ...(doc
        ? [
            {
              name: 'preview' as const,
              run: async () => {
                const { generateAccurateSvgPreview } = await import(
                  '../diagram/serverDiagramRenderer'
                );
                const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
                const preview =
                  (await generateAccurateSvgPreview(doc!)) ?? generateSvgPreview(doc!) ?? null;
                if (resolved.kind === 'workspace') {
                  await db.project.updateWorkspaceContentNodeDerivedData(
                    ws,
                    rootId,
                    rootContent.length,
                    counts.commentCount,
                    counts.unresolvedCommentCount,
                    preview,
                    timestamp
                  );
                } else {
                  await db.project.updateContentNodePreview(
                    ws,
                    resolved.storageId,
                    rootId,
                    preview
                  );
                }
              }
            }
          ]
        : []),
      ...(doc
        ? [
            {
              name: 'references' as const,
              run: () => db.project.syncDiagramEntityRefs(ws, rootId, getDiagramEntityRefs(doc!))
            }
          ]
        : []),
      {
        name: 'audit',
        run: tx =>
          writeAudit(tx, {
            userId: authCtx.userId,
            workspace: ws,
            operation: 'update',
            entityType: 'content_node',
            entityId: rootId,
            entityName: displayName,
            changes: {
              old: { path: filePath, name: source.name },
              new: { path: newPath, name: displayName }
            },
            metadata: { ...resolved.auditMetadata, operation: 'relocate' }
          })
      }
    ]
  });
  return toApiProjectFile(saved);
};

export const createWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return writeScopedDiagram(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    body,
    event
  );
};

export const getWorkspaceFileContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  return readScopedDiagram(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    event,
    'Failed to retrieve workspace file content'
  );
};

export const saveWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return createWorkspaceFile(db, storage, workspace, filePath, body, event);
};

export const getProjectFile = async (
  db: DatabaseAdapter,
  workspace: string,
  fileId: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve file',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, fileId);
      httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });
      const resolved = await resolveContentScopeForNode(db, ws, authCtx, node, 'read');
      if (resolved.kind === 'project') node.project_public_id = resolved.projectPublicId;
      return toApiProjectFile(node);
    }
  });
};

export const getFileContentById = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  fileId: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve file content',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const node = await db.project.getAnyContentNodeById(ws, fileId);
      httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });
      const resolved = await resolveContentScopeForNode(db, ws, authCtx, node, 'read');
      const content = await storage.read(ws, resolved.storageId, node.id);
      return JSON.parse(content.toString('utf8'));
    }
  });
};
