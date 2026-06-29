import { defineHandler, HTTPError } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
} from './workspaceOperations';
import { exportWorkspace, calculateChecksum } from './exportOperations';
import { parseImport, executeImport } from './importOperations';
import { storeImportCache, getImportCache, deleteImportCache } from './importCache';
import { ZipBuilder, ZipExtractor } from '../../utils/zipBuilder';
import { buildApiAuthCtx } from '../auth/authorization';
import { resolveWorkspace } from './resolveWorkspace';
import { SCHEMA_TEMPLATES } from '../catalog/schemaTemplates';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';
import type { 
  ExportManifest, 
  ExportConfig, 
  ExportSchema, 
  ExportEntity, 
  ExportProject, 
  ExportContentNode 
} from './exportTypes';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

const wsRouter = implement(workspaceManagementContract).$context<ORPCContext>();

export const workspaceManagementORPCRouter = wsRouter.router({
  workspaces: {
    list: wsRouter.workspaces.list.handler(async ({ context }) => {
      try {
        return await listWorkspaces(context.db);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: wsRouter.workspaces.create.handler(async ({ input, context }) => {
      try {
        return await createWorkspace(context.db, input.body, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: wsRouter.workspaces.update.handler(async ({ input, context }) => {
      try {
        return await updateWorkspace(context.db, input.params.workspace, input.body, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: wsRouter.workspaces.remove.handler(async ({ input, context }) => {
      try {
        return await deleteWorkspace(
          context.db,
          input.params.workspace,
          context.event,
          context.storage
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    templates: wsRouter.workspaces.templates.handler(async () => {
      try {
        return SCHEMA_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
      } catch (error) {
        return toORPCError(error);
      }
    }),
    export: wsRouter.workspaces.export.handler(async ({ input, context }) => {
      try {
        const workspaceId = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspaceId, context.event);

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

        if (data.entities) {
          const content = JSON.stringify(data.entities, null, 2);
          zipBuilder.addText('entities.json', content);
          checksums['entities.json'] = calculateChecksum(content);
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
      } catch (error) {
        return toORPCError(error);
      }
    }),
    importParse: wsRouter.workspaces.importParse.handler(async ({ input, context }) => {
      try {
        const workspaceId = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspaceId, context.event);

        // Extract ZIP file contents
        // ORPC/OpenAPI may pass the file as Buffer, Blob, or File
        const file = input.body.file;
        let zipBuffer: Buffer;

        type FileWithArrayBuffer = { arrayBuffer: () => Promise<ArrayBuffer> };
        type FileWithData = { data: Buffer };

        if (Buffer.isBuffer(file)) {
          zipBuffer = file;
        } else if (file && typeof (file as FileWithArrayBuffer).arrayBuffer === 'function') {
          const arrayBuffer = await (file as FileWithArrayBuffer).arrayBuffer();
          zipBuffer = Buffer.from(arrayBuffer);
        } else if (file && typeof file === 'object' && 'data' in file && Buffer.isBuffer((file as FileWithData).data)) {
          zipBuffer = (file as FileWithData).data;
        } else {
          throw new HTTPError({ status: 400, message: 'Invalid file format - expected File, Blob, or Buffer' });
        }
        
        const extracted = await ZipExtractor.parseImportZip(zipBuffer);

        // Parse and validate the import data
        const result = await parseImport(
          context.db,
          authCtx,
          workspaceId,
          extracted.manifest as ExportManifest,
          {
            config: extracted.config as ExportConfig | undefined,
            schemas: extracted.schemas as ExportSchema[] | undefined,
            entities: extracted.entities as ExportEntity[] | undefined,
            projects: extracted.projects as ExportProject[] | undefined,
            content_nodes: extracted.content_nodes as ExportContentNode[] | undefined
          }
        );

        // Store parsed data in cache for later execution
        const importId = await storeImportCache(
          context.db,
          workspaceId,
          authCtx.userId,
          extracted.manifest as ExportManifest,
          {
            config: extracted.config as ExportConfig | undefined,
            schemas: extracted.schemas as ExportSchema[] | undefined,
            entities: extracted.entities as ExportEntity[] | undefined,
            projects: extracted.projects as ExportProject[] | undefined,
            content_nodes: extracted.content_nodes as ExportContentNode[] | undefined
          },
          extracted.contentFiles
        );

        return {
          ...result,
          import_id: importId
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),
    importExecute: wsRouter.workspaces.importExecute.handler(async ({ input, context }) => {
      try {
        const workspaceId = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspaceId, context.event);

        // Retrieve cached import data
        const cached = await getImportCache(
          context.db,
          workspaceId,
          authCtx.userId,
          input.body.import_id
        );

        if (!cached) {
          throw new HTTPError({ status: 404, message: 'Import data not found or expired. Please upload the file again.' });
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
          authCtx,
          workspaceId,
          executeOptions,
          cached.data
        );

        // Clean up cache after successful import
        await deleteImportCache(context.db, input.body.import_id);

        return result;
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceManagementOpenAPIHandler = new OpenAPIHandler(workspaceManagementORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceManagementORPCHandler = (
  db: DatabaseAdapter,
  storage?: StorageAdapter
) =>
  defineHandler(async event => {
    const result = await workspaceManagementOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        storage,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
