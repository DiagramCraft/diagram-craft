import { HTTPError } from 'h3';
import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
} from './workspaceOperations';
import { exportWorkspace, calculateChecksum } from './exportOperations';
import { parseImport } from './importParseOperations';
import { executeImport } from './importExecutionOperations';
import { storeImportCache, getImportCache, deleteImportCache } from './importCache';
import { ImportArchiveValidationError, ZipBuilder, ZipExtractor } from '../../utils/zipBuilder';
import { SCHEMA_TEMPLATES } from '../catalog/schemaTemplates';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import {
  executeDefinitionImport,
  listDefinitionImportSources,
  previewDefinitionImport
} from './definitionImportOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

type FileWithArrayBuffer = { arrayBuffer: () => Promise<ArrayBuffer> };
type FileWithData = { data: Buffer };

const hasArrayBuffer = (value: unknown): value is FileWithArrayBuffer =>
  value !== null &&
  typeof value === 'object' &&
  'arrayBuffer' in value &&
  typeof value.arrayBuffer === 'function';

const hasBufferData = (value: unknown): value is FileWithData =>
  value !== null && typeof value === 'object' && 'data' in value && Buffer.isBuffer(value.data);

const wsRouter = implement(workspaceManagementContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

const workspaceScopedRouter = wsRouter.use(workspaceScoped);

export const workspaceManagementORPCRouter = wsRouter.router({
  workspaces: {
    list: wsRouter.workspaces.list.handler(async ({ context }) => {
      return await listWorkspaces(context.db, context.event);
    }),
    create: wsRouter.workspaces.create.handler(async ({ input, context }) => {
      return await createWorkspace(context.db, input.body, context.event, context.storage);
    }),
    update: wsRouter.workspaces.update.handler(async ({ input, context }) => {
      return await updateWorkspace(context.db, input.params.workspace, input.body, context.event);
    }),
    remove: wsRouter.workspaces.remove.handler(async ({ input, context }) => {
      return await deleteWorkspace(
        context.db,
        input.params.workspace,
        context.event,
        context.storage
      );
    }),
    templates: wsRouter.workspaces.templates.handler(async () => {
      return SCHEMA_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
    }),
    definitionImportSources: workspaceScopedRouter.workspaces.definitionImportSources.handler(
      async ({ input, context }) =>
        listDefinitionImportSources(context.db, input.params.workspace, context.event)
    ),
    definitionImportPreview: workspaceScopedRouter.workspaces.definitionImportPreview.handler(
      async ({ input, context }) =>
        previewDefinitionImport(context.db, input.params.workspace, input.body, context.event)
    ),
    definitionImportExecute: workspaceScopedRouter.workspaces.definitionImportExecute.handler(
      async ({ input, context }) =>
        executeDefinitionImport(context.db, input.params.workspace, input.body, context.event)
    ),
    export: workspaceScopedRouter.workspaces.export.handler(async ({ input, context }) => {
      const { workspace: workspaceId, authCtx } = context;

      const workspaceData = await context.db.workspace.getWorkspace(workspaceId);

      const { manifest, data, contentFiles } = await exportWorkspace(
        context.db,
        context.storage,
        authCtx,
        workspaceId,
        input.body
      );

      // Build ZIP archive
      const zipBuilder = new ZipBuilder();

      // Add data files with checksums
      const checksums: Record<string, string> = {};

      if (data.config) {
        const content = JSON.stringify(data.config, null, 2);
        zipBuilder.addText('config.json', content);
        checksums['config.json'] = calculateChecksum(content);
      }

      if (data.schemas) {
        const content = JSON.stringify(data.schemas, null, 2);
        zipBuilder.addText('schemas.json', content);
        checksums['schemas.json'] = calculateChecksum(content);
      }

      if (data.relation_schemas) {
        const content = JSON.stringify(data.relation_schemas, null, 2);
        zipBuilder.addText('relation-schemas.json', content);
        checksums['relation-schemas.json'] = calculateChecksum(content);
      }

      if (data.entities) {
        const content = JSON.stringify(data.entities, null, 2);
        zipBuilder.addText('entities.json', content);
        checksums['entities.json'] = calculateChecksum(content);
      }

      if (data.relations) {
        const content = JSON.stringify(data.relations, null, 2);
        zipBuilder.addText('relations.json', content);
        checksums['relations.json'] = calculateChecksum(content);
      }

      if (data.projects) {
        const content = JSON.stringify(data.projects, null, 2);
        zipBuilder.addText('projects.json', content);
        checksums['projects.json'] = calculateChecksum(content);
      }

      if (data.content_nodes) {
        const content = JSON.stringify(data.content_nodes, null, 2);
        zipBuilder.addText('content-nodes.json', content);
        checksums['content-nodes.json'] = calculateChecksum(content);

        // Add actual content files from storage
        if (input.body.options?.include_content && contentFiles) {
          zipBuilder.addDirectory('content');
          zipBuilder.addDirectory('content/diagrams');
          zipBuilder.addDirectory('content/markdowns');
          zipBuilder.addDirectory('content/files');

          // Add all content files to the ZIP
          for (const [path, buffer] of contentFiles.entries()) {
            zipBuilder.addBuffer(path, buffer);
          }
        }
      }

      if (data.documents) {
        const content = JSON.stringify(data.documents, null, 2);
        zipBuilder.addText('documents.json', content);
        checksums['documents.json'] = calculateChecksum(content);
      }

      // Update manifest with checksums
      manifest.checksums = checksums;
      zipBuilder.addJson('manifest.json', manifest);

      // Finalize and collect the ZIP data
      const stream = await zipBuilder.finalize();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const zipBuffer = Buffer.concat(chunks);

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `workspace-${workspaceData?.url_slug ?? 'export'}-${timestamp}.zip`;

      return {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`
        },
        body: new Blob([zipBuffer], { type: 'application/zip' })
      };
    }),
    importParse: workspaceScopedRouter.workspaces.importParse.handler(
      async ({ input, context }) => {
        const { workspace: workspaceId, authCtx } = context;

        // Extract ZIP file contents
        // ORPC/OpenAPI may pass the file as Buffer, Blob, or File
        const file: unknown = input.body.file;
        let zipBuffer: Buffer;

        if (Buffer.isBuffer(file)) {
          zipBuffer = file;
        } else if (hasArrayBuffer(file)) {
          const arrayBuffer = await file.arrayBuffer();
          zipBuffer = Buffer.from(arrayBuffer);
        } else if (hasBufferData(file)) {
          zipBuffer = file.data;
        } else {
          throw new HTTPError({
            status: 400,
            message: 'Invalid file format - expected File, Blob, or Buffer'
          });
        }

        let extracted: Awaited<ReturnType<typeof ZipExtractor.parseImportZip>>;
        try {
          extracted = await ZipExtractor.parseImportZip(zipBuffer);
        } catch (error) {
          if (error instanceof ImportArchiveValidationError) {
            throw new HTTPError({ status: 400, message: error.message });
          }
          throw error;
        }
        const manifest = extracted.manifest;
        for (const [path, checksum] of Object.entries(manifest.checksums ?? {})) {
          const content = extracted.jsonFiles.get(path);
          if (!content || calculateChecksum(content) !== checksum) {
            throw new HTTPError({
              status: 400,
              message: `Import archive checksum mismatch: ${path}`
            });
          }
        }

        // Parse and validate the import data
        const result = await parseImport(context.db, authCtx, workspaceId, manifest, extracted);

        if (!result.valid) return result;

        // Only validated archives become executable sessions.
        const importId = await storeImportCache(
          context.db,
          workspaceId,
          authCtx.userId,
          manifest,
          extracted,
          extracted.contentFiles
        );

        return { ...result, import_id: importId };
      }
    ),
    importExecute: workspaceScopedRouter.workspaces.importExecute.handler(
      async ({ input, context }) => {
        const { workspace: workspaceId, authCtx } = context;

        // Retrieve cached import data
        const cached = await getImportCache(
          context.db,
          workspaceId,
          authCtx.userId,
          input.body.import_id
        );

        if (!cached) {
          throw new HTTPError({
            status: 404,
            message: 'Import data not found or expired. Please upload the file again.'
          });
        }

        const executeOptions = {
          import_id: input.body.import_id,
          include: input.body.include,
          conflict_resolutions: input.body.conflict_resolutions,
          preserve_ids: input.body.options?.preserve_ids ?? false,
          update_references: input.body.options?.update_references ?? true
        };

        // Execute import with conflict resolutions and cached data
        const result = await executeImport(
          context.db,
          context.storage,
          authCtx,
          workspaceId,
          executeOptions,
          cached.data,
          cached.contentFiles
        );

        // Clean up cache after successful import
        await deleteImportCache(context.db, input.body.import_id);

        return result;
      }
    )
  }
});

export const createWorkspaceManagementORPCHandler = (
  db: DatabaseAdapter,
  storage?: StorageAdapter
) =>
  createOrpcHandler(workspaceManagementORPCRouter, {
    context: event => ({ db, storage, event: event as AuthenticatedEvent })
  });
