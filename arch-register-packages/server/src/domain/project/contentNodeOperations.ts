import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { getDiagramCommentCounts } from '../diagram/commentCounts';
import { getDiagramEntityRefs } from '../diagram/diagramEntityRefs';
import {
  buildApiAuthCtx,
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceAdmin
} from '../auth/authorization';
import {
  logAudit,
  writeAudit,
  extractEntityFields,
  computeChanges
} from '../audit/db/auditLogging';
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
  buildFileTree,
  deleteContentFile,
  deleteContentFolder,
  renameContentFolder
} from './contentTreeOperations';
import { ENTITY_SCOPE, PROJECT_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import type { ContentScopeResolver } from './contentScope';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { coordinateContentWrite } from './contentWriteCoordinator';
import {
  handleError,
  reloadContentNode,
  requireNonProjectContentAccess,
  syncDiagramContentMetadata
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

export const listProjectFiles = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAccess(authCtx, project.owner);
    const files = await db.project.listContentNodes(ws, project.id);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to list files');
  }
};

export const createFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, project.id, parentPath);
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: project.id,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { project_id: project.id, path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create folder');
  }
};

export const createEntityFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'edit');
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const entityUuid = entity.id;

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      // For entity content, find parent by querying entity content nodes
      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const parentFolder = entityNodes.find(n => n.path === parentPath && n.type === 'folder');
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: null,
      entity_id: entityUuid,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { entity_id: entityUuid, path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create entity folder');
  }
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
  const existing = nodes.find(node => node.path === filePath && node.type === 'diagram');
  const folderPath = folderFromPath(filePath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
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
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: parentId,
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
        run: () =>
          writeAudit(db, {
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

export const renameFolder = (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(PROJECT_SCOPE, db, workspace, id, oldPath, newPath, event);

export const getFileContent = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);

    // Try to get as project first
    const project = await db.project.getProject(ws, id);

    let file: { id: string; path: string } | null = null;
    let storageId = id;

    if (project) {
      // It's a project - use normal project file lookup
      requireProjectAccess(authCtx, project.owner);
      storageId = project.id;
      file = await db.project.getContentNodeByPath(ws, project.id, filePath);
    } else {
      // Not a project - try as entity content (resolve public id → UUID)
      const entity = await db.catalog.getEntity(ws, id);
      if (entity) {
        const entityNodes = await db.project.listEntityContentNodes(ws, entity.id);
        file = entityNodes.find(n => n.path === filePath && n.type === 'diagram') ?? null;
        storageId = entity.id; // entity UUID is used as storage path
      }
    }

    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    const content = await storage.read(ws, storageId, file.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    if (
      e != null &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: string }).code === 'ENOENT'
    ) {
      throw new HTTPError({
        status: 404,
        statusText: 'Not Found',
        message: `File '${filePath}' not found`
      });
    }
    return handleError(e, 'Failed to read file');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  const content = Buffer.from(JSON.stringify(body), 'utf8');
  const displayName = displayNameFromBody(body, filePath);

  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);

    // If not a project, treat as entity diagram
    if (!project) {
      return await createEntityFile(db, storage, workspace, id, filePath, body, event);
    }
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const existingFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    const isUpdate = !!existingFile;

    const fileLastSlash = filePath.lastIndexOf('/');
    let fileParentId: string | null = null;
    if (fileLastSlash !== -1) {
      const folderPath = filePath.substring(0, fileLastSlash);
      const parentFolder = await db.project.getContentNodeByPath(ws, projectUuid, folderPath);
      fileParentId = parentFolder?.id ?? null;
    }

    // TODO: We should add validation here
    const doc = body as unknown as SerializedDiagramDocument;

    const timestamp = new Date();
    const commentCounts = getDiagramCommentCounts(doc);
    const nodeId = existingFile?.id ?? randomUUID();
    const entityRefs = getDiagramEntityRefs(doc);
    let savedRow!: ContentNodeDbResult;
    await coordinateContentWrite({
      db,
      storage,
      operation: isUpdate ? 'update' : 'create',
      scope: 'project',
      nodeIds: [nodeId],
      storageChanges: [{ type: 'write', workspace: ws, storageId: projectUuid, nodeId, content }],
      writeDatabase: async tx => {
        const row = await tx.project.upsertContentNode({
          id: nodeId,
          workspace: ws,
          project_id: projectUuid,
          parent_id: fileParentId,
          path: filePath,
          name: String(displayName),
          size_bytes: content.length,
          comment_count: commentCounts.commentCount,
          unresolved_comment_count: commentCounts.unresolvedCommentCount,
          created_atIfNew: existingFile?.created_at ?? timestamp,
          updated_at: timestamp,
          created_byIfNew: existingFile?.created_by ?? authCtx.userId,
          updated_by: authCtx.userId
        });
        await syncDiagramContentMetadata(tx, ws, row.id, doc, timestamp);
        savedRow = await reloadContentNode(tx, ws, row.id);
      },
      afterCommit: [
        {
          name: 'preview',
          run: async () => {
            const { generateAccurateSvgPreview } = await import('../diagram/serverDiagramRenderer');
            const { generateSvgPreview } = await import('../diagram/svgPreviewGenerator');
            const previewSvg = (await generateAccurateSvgPreview(doc)) ?? generateSvgPreview(doc);
            await db.project.updateContentNodePreview(ws, projectUuid, nodeId, previewSvg ?? null);
          }
        },
        { name: 'references', run: () => db.project.syncDiagramEntityRefs(ws, nodeId, entityRefs) },
        {
          name: 'audit',
          run: () =>
            writeAudit(db, {
              userId: authCtx.userId,
              workspace: ws,
              operation: isUpdate ? 'update' : 'create',
              entityType: 'content_node',
              entityId: nodeId,
              entityName: savedRow.name,
              changes: isUpdate
                ? computeChanges(extractEntityFields(existingFile), extractEntityFields(savedRow))
                : { new: extractEntityFields(savedRow) },
              metadata: { project_id: projectUuid, path: filePath }
            })
        }
      ]
    });

    return toApiProjectFile(savedRow);
  } catch (e) {
    return handleError(e, 'Failed to write file');
  }
};

export const deleteFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, id);
    httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
    const projectUuid = project.id;

    requireProjectAction(
      authCtx,
      project.owner,
      'edit_project',
      'You do not have permission to modify this project'
    );

    const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    const siblingNodes =
      file.type === 'markdown' ? await db.project.listContentNodes(ws, projectUuid) : [];

    const attachmentNodes =
      file.type === 'markdown'
        ? (() => {
            const container = getAttachmentContainerForMarkdownNode(siblingNodes, file.id);
            return container
              ? [container, ...collectDescendantNodes(siblingNodes, container.id)]
              : [];
          })()
        : [];
    const blobNodes = [file, ...attachmentNodes].filter(node => node.type !== 'folder');
    await coordinateContentWrite({
      db,
      storage,
      operation: 'delete',
      scope: 'project',
      nodeIds: [file.id, ...attachmentNodes.map(node => node.id)],
      storageChanges: blobNodes.map(node => ({
        type: 'delete' as const,
        workspace: ws,
        storageId: projectUuid,
        nodeId: node.id
      })),
      writeDatabase: async tx => {
        await tx.project.deleteContentNodeByPath(ws, projectUuid, filePath);
      },
      afterCommit: [
        {
          name: 'audit',
          run: () =>
            writeAudit(db, {
              userId: authCtx.userId,
              workspace: ws,
              operation: 'delete',
              entityType: 'content_node',
              entityId: file.id,
              entityName: file.name,
              changes: { old: extractEntityFields(file) },
              metadata: { project_id: projectUuid, path: filePath }
            })
        }
      ]
    });

    return { success: true };
  } catch (e) {
    return handleError(e, 'Failed to delete file');
  }
};

const cloneScopedContentFile = async (
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
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
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
          project_id: resolved.projectId,
          entity_id: resolved.entityId,
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
        run: () =>
          writeAudit(db, {
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

export const cloneFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(PROJECT_SCOPE, db, storage, workspace, id, filePath, event);
};

const relocateScopedContentFile = async (
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
  httpAssert.true(!nodes.some(node => node.path === newPath), {
    status: 409,
    message: `A file already exists at '${newPath}'`
  });
  const displayName = getDisplayNameForPath(source, newPath);
  const folderPath = folderFromPath(newPath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
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
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
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
          project_id: resolved.projectId,
          entity_id: resolved.entityId,
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
        run: () =>
          writeAudit(db, {
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

export const relocateFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return relocateScopedContentFile(
    PROJECT_SCOPE,
    db,
    storage,
    workspace,
    id,
    filePath,
    newPath,
    event
  );
};

export const deleteFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(PROJECT_SCOPE, db, storage, workspace, id, folderPath, event);

export const updateTemplateStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  filePath: string,
  isTemplate: boolean,
  isWorkspaceTemplate: boolean,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const project = await db.project.getProject(ws, projectId);
    httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
    const projectUuid = project.id;

    if (isWorkspaceTemplate) {
      requireWorkspaceAdmin(authCtx, 'Only workspace admins can manage workspace templates');
    } else {
      requireProjectAccess(authCtx, project.owner);
    }

    const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });

    await db.project.updateContentNodeTemplateStatus(
      ws,
      projectUuid,
      file.id,
      isTemplate,
      isWorkspaceTemplate,
      new Date()
    );

    const updatedFile = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
    return toApiProjectFile(updatedFile!);
  } catch (e) {
    return handleError(e, 'Failed to update template status');
  }
};

export const listEntityContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireNonProjectContentAccess(authCtx, 'read');
  try {
    const entity = await db.catalog.getEntity(ws, entityId);
    httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
    const files = await db.project.listEntityContentNodes(ws, entity.id);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to retrieve entity content nodes');
  }
};

export const listWorkspaceContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<FileTree> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireNonProjectContentAccess(authCtx, 'read');
  try {
    const files = await db.project.listWorkspaceContentNodes(ws);
    return buildFileTree(files);
  } catch (e) {
    return handleError(e, 'Failed to retrieve workspace content nodes');
  }
};

export const createWorkspaceFolder = async (
  db: DatabaseAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; path: string; marker: ProjectFile | null }> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'edit');

    const lastSlash = folderPath.lastIndexOf('/');
    const folderName = lastSlash !== -1 ? folderPath.substring(lastSlash + 1) : folderPath;
    let parentId: string | null = null;
    if (lastSlash !== -1) {
      const parentPath = folderPath.substring(0, lastSlash);
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const parentFolder = wsNodes.find(n => n.path === parentPath && n.type === 'folder');
      parentId = parentFolder?.id ?? null;
    }

    const timestamp = new Date();
    const row = await db.project.createContentNodeIfAbsent({
      workspace: ws,
      project_id: null,
      entity_id: null,
      parent_id: parentId,
      path: folderPath,
      name: folderName,
      type: 'folder',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: timestamp,
      updated_at: timestamp,
      created_byIfNew: authCtx.userId,
      updated_by: authCtx.userId
    });
    if (row) {
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'content_node',
        entityId: row.id,
        entityName: folderPath,
        changes: { new: { path: folderPath, type: 'folder' } },
        metadata: { path: folderPath, is_folder: true }
      });
    }
    return { success: true, path: folderPath, marker: row ? toApiProjectFile(row) : null };
  } catch (e) {
    return handleError(e, 'Failed to create workspace folder');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    requireNonProjectContentAccess(authCtx, 'read');
    const wsNodes = await db.project.listWorkspaceContentNodes(ws);
    const file = wsNodes.find(n => n.path === filePath && n.type === 'diagram') ?? null;
    httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
    const content = await storage.read(ws, ws, file.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    return handleError(e, 'Failed to retrieve workspace file content');
  }
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
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, fileId);
    httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });
    if (node.project_id) {
      const project = await db.project.getProject(ws, node.project_id);
      httpAssert.present(project, { status: 404, message: 'Project not found' });
      requireProjectAccess(authCtx, project.owner);
      node.project_public_id = project.public_id;
    } else {
      requireNonProjectContentAccess(authCtx, 'read');
    }
    return toApiProjectFile(node);
  } catch (e) {
    return handleError(e, 'Failed to retrieve file');
  }
};

export const getFileContentById = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  fileId: string,
  event: AuthenticatedEvent
): Promise<Record<string, unknown>> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  try {
    const authCtx = await buildApiAuthCtx(db, ws, event);
    const node = await db.project.getAnyContentNodeById(ws, fileId);
    httpAssert.present(node, { status: 404, message: `File '${fileId}' not found` });

    let storageId: string;
    if (node.project_id) {
      const project = await db.project.getProject(ws, node.project_id);
      httpAssert.present(project, { status: 404, message: 'Project not found' });
      requireProjectAccess(authCtx, project.owner);
      storageId = node.project_id;
    } else if (node.entity_id) {
      requireNonProjectContentAccess(authCtx, 'read');
      storageId = node.entity_id;
    } else {
      requireNonProjectContentAccess(authCtx, 'read');
      storageId = ws;
    }

    const content = await storage.read(ws, storageId, node.id);
    return JSON.parse(content.toString('utf8'));
  } catch (e) {
    return handleError(e, 'Failed to retrieve file content');
  }
};

export const deleteEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  return deleteContentFile(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, event);
};

export const deleteEntityFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(ENTITY_SCOPE, db, storage, workspace, entityId, folderPath, event);

export const renameEntityFolder = (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(ENTITY_SCOPE, db, workspace, entityId, oldPath, newPath, event);

export const cloneEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(ENTITY_SCOPE, db, storage, workspace, entityId, filePath, event);
};

export const relocateEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return relocateScopedContentFile(
    ENTITY_SCOPE,
    db,
    storage,
    workspace,
    entityId,
    filePath,
    newPath,
    event
  );
};

export const deleteWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean }> => {
  return deleteContentFile(WORKSPACE_SCOPE, db, storage, workspace, undefined, filePath, event);
};

export const deleteWorkspaceFolder = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  folderPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; count: number }> =>
  deleteContentFolder(WORKSPACE_SCOPE, db, storage, workspace, undefined, folderPath, event);

export const renameWorkspaceFolder = (
  db: DatabaseAdapter,
  workspace: string,
  oldPath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string; count: number }> =>
  renameContentFolder(WORKSPACE_SCOPE, db, workspace, undefined, oldPath, newPath, event);

export const cloneWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return cloneScopedContentFile(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    event
  );
};

export const relocateWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  newPath: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return relocateScopedContentFile(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    newPath,
    event
  );
};
