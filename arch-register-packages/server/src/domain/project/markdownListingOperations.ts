import type { DatabaseAdapter } from '../../db/database';

import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineEntityOperation, defineOperation } from '../operation';
import { requireEntityAction } from '../auth/authorization';

import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';

import { httpAssert } from '../../utils/httpAssert';

import type { ProjectFile } from '@arch-register/api-types/projectContract';

import type { DocumentListItem } from '@arch-register/api-types/projectContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

import {
  compareDocuments,
  matchesDocumentCondition,
  type DocumentListCandidate
} from '../document/documentFilterHelpers';

import { projectDbErrorMessages } from './projectOperationHelpers';

import {
  getDocumentState,
  requireMarkdownNodeAccess,
  isMarkdownNode
} from './markdownOperationHelpers';
export const listRelatedContent = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
) =>
  defineEntityOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve related content', dbErrorMessages: projectDbErrorMessages },
    async ({ ws, authCtx }) => {
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
      const links = await db.document.listDocumentsLinkingEntity(ws, entity.id);
      const result: Array<{
        file: ProjectFile;
        scope: 'project' | 'entity' | 'workspace';
        document_type_id: string | null;
        document_type_name: string | null;
        document_type_color: string | null;
        document_type_icon: string | null;
        field_id: string;
        field_name: string;
        field_inverse_name: string | null;
      }> = [];
      const seen = new Set<string>();
      for (const link of links) {
        const node = await db.project.getAnyContentNodeById(ws, link.node_id);
        if (!node || !isMarkdownNode(node)) continue;
        try {
          await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
        } catch {
          continue;
        }
        const state = await getDocumentState(db, ws, node);
        const field = state.documentType?.fields.find(item => item.id === link.field_id);
        const key = `${node.id}:${link.field_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          file: toApiProjectFile(node),
          scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
          document_type_id: state.documentTypeId,
          document_type_name: state.documentType?.name ?? null,
          document_type_color: state.documentType?.color ?? null,
          document_type_icon: state.documentType?.icon ?? null,
          field_id: link.field_id,
          field_name: field?.name ?? link.field_id,
          field_inverse_name: field?.inverseName ?? null
        });
      }
      return result;
    }
  );

// Documents whose entity_link/document_link metadata points at this document.
// Mirrors listRelatedContent's entity-reverse-lookup, but for a document target;
// see #2109. Silently drops any source document the current user cannot read,
// so an inaccessible document can never be revealed via a backlink, count, or label.
export const listDocumentBacklinks = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  event: AuthenticatedEvent
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve document backlinks', dbErrorMessages: projectDbErrorMessages },
    async ({ ws, authCtx }) => {
      const targetNode = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(targetNode, {
        status: 404,
        message: `Markdown document '${nodeId}' not found`
      });
      httpAssert.true(isMarkdownNode(targetNode), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      await requireMarkdownNodeAccess(db, ws, authCtx, targetNode, 'read');

      const links = await db.document.listDocumentsLinkingDocument(ws, targetNode.id);
      const result: Array<{
        file: ProjectFile;
        scope: 'project' | 'entity' | 'workspace';
        document_type_id: string | null;
        document_type_name: string | null;
        document_type_color: string | null;
        document_type_icon: string | null;
        field_id: string;
        field_name: string;
        field_inverse_name: string | null;
      }> = [];
      const seen = new Set<string>();
      for (const link of links) {
        const node = await db.project.getAnyContentNodeById(ws, link.node_id);
        if (!node || !isMarkdownNode(node)) continue;
        try {
          await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
        } catch {
          continue;
        }
        const state = await getDocumentState(db, ws, node);
        const field = state.documentType?.fields.find(item => item.id === link.field_id);
        const key = `${node.id}:${link.field_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          file: toApiProjectFile(node),
          scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
          document_type_id: state.documentTypeId,
          document_type_name: state.documentType?.name ?? null,
          document_type_color: state.documentType?.color ?? null,
          document_type_icon: state.documentType?.icon ?? null,
          field_id: link.field_id,
          field_name: field?.name ?? link.field_id,
          field_inverse_name: field?.inverseName ?? null
        });
      }
      return result;
    }
  );

export const listDocuments = async (
  db: DatabaseAdapter,
  workspace: string,
  options: {
    q?: string;
    scope?: 'workspace' | 'project' | 'entity';
    projectId?: string;
    entityId?: string;
    documentTypeId?: string;
    conditions?: FilterCondition[];
    sort?: string;
    sortDir?: 'asc' | 'desc';
    limit?: number;
  },
  event: AuthenticatedEvent
): Promise<DocumentListItem[]> =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to list documents', dbErrorMessages: projectDbErrorMessages },
    async ({ ws, authCtx }) => {
      const resolvedProject = options.projectId
        ? await db.project.getProject(ws, options.projectId)
        : null;
      if (options.projectId && !resolvedProject) return [];

      const resolvedEntity = options.entityId
        ? await db.catalog.getEntity(ws, options.entityId)
        : null;
      if (options.entityId && !resolvedEntity) return [];

      const projectId = resolvedProject?.id ?? options.projectId;
      const entityId = resolvedEntity?.id ?? options.entityId;
      const nodes = await db.project.listAllContentNodes(ws);
      const candidates: Array<{
        node: ContentNodeDbResult;
        scope: 'workspace' | 'project' | 'entity';
        state: Awaited<ReturnType<typeof getDocumentState>>;
        candidate: DocumentListCandidate;
      }> = [];

      const q = options.q?.trim().toLowerCase();

      for (const node of nodes) {
        if (!isMarkdownNode(node)) continue;
        const scope: 'workspace' | 'project' | 'entity' = node.project_id
          ? 'project'
          : node.entity_id
            ? 'entity'
            : 'workspace';
        if (options.scope && options.scope !== scope) continue;
        if (projectId && node.project_id !== projectId) continue;
        if (entityId && node.entity_id !== entityId) continue;

        try {
          await requireMarkdownNodeAccess(db, ws, authCtx, node, 'read');
        } catch {
          continue;
        }

        const state = await getDocumentState(db, ws, node);
        if (options.documentTypeId === 'none' && state.documentTypeId !== null) continue;
        if (
          options.documentTypeId &&
          options.documentTypeId !== 'none' &&
          state.documentTypeId !== options.documentTypeId
        ) {
          continue;
        }

        if (q && !node.name.toLowerCase().includes(q)) continue;

        const candidate: DocumentListCandidate = {
          title: node.name,
          updatedAt: node.updated_at,
          documentTypeId: state.documentTypeId,
          metadata: state.metadata
        };

        if (
          options.conditions?.length &&
          !options.conditions.every(condition => matchesDocumentCondition(candidate, condition))
        ) {
          continue;
        }

        candidates.push({ node, scope, state, candidate });
      }

      candidates.sort((a, b) =>
        compareDocuments(a.candidate, b.candidate, options.sort, options.sortDir ?? 'asc')
      );

      return candidates.slice(0, options.limit ?? 100).map(({ node, scope, state }) => ({
        file: toApiProjectFile(node),
        scope,
        document_type_id: state.documentTypeId,
        document_type_name: state.documentType?.name ?? null,
        document_type_color: state.documentType?.color ?? null,
        document_type_icon: state.documentType?.icon ?? null,
        metadata: state.metadata
      }));
    }
  );
