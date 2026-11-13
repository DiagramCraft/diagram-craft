import { useCallback, useMemo } from 'react';
import type {
  SchemaDraft,
  SchemaDraftItem,
  SchemaDraftKind,
  SchemaDraftOp
} from '@arch-register/api-types/schemaDraftContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useSchemaChangeMode,
  useSchemaDraft,
  useStageSchemaItem,
  useUnstageSchemaItem
} from '../../hooks/useSchemaDraft';

export type { SchemaDraftItem, SchemaDraftKind, SchemaDraftOp };

export type SchemaDraftState = {
  /** True when saves must be staged instead of written live. */
  isDraftMode: boolean;
  draft: SchemaDraft | undefined;
  pendingCount: number;
  itemFor: (kind: SchemaDraftKind, id: string) => SchemaDraftItem | undefined;
  isStaged: (kind: SchemaDraftKind, id: string) => boolean;
  stage: (kind: SchemaDraftKind, id: string, op: SchemaDraftOp, payload?: unknown) => Promise<void>;
  unstage: (kind: SchemaDraftKind, id: string) => Promise<void>;
  /** Stages a new item under a client-generated id and returns that id. */
  stageCreate: (kind: SchemaDraftKind, body: unknown) => Promise<string>;
  /** Stages an edit; an item that is itself a staged create stays a create. */
  stageUpdate: (kind: SchemaDraftKind, id: string, body: unknown) => Promise<void>;
  /** Stages a delete; deleting a staged create just drops it from the draft. */
  stageDelete: (kind: SchemaDraftKind, id: string) => Promise<void>;
};

/**
 * The workspace schema draft and staging actions. Backed by the shared query cache, so the
 * sidebar and the editors (rendered in separate route slots) always see the same state.
 */
export const useSchemaDraftState = (): SchemaDraftState => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: mode } = useSchemaChangeMode(workspaceSlug);
  const isDraftMode = mode?.schemaChangeMode === 'draft';
  const { data: draft } = useSchemaDraft(workspaceSlug);
  const stageMutation = useStageSchemaItem(workspaceSlug);
  const unstageMutation = useUnstageSchemaItem(workspaceSlug);

  const itemFor = useCallback(
    (kind: SchemaDraftKind, id: string) =>
      draft?.items.find(item => item.kind === kind && item.item_id === id),
    [draft]
  );

  return useMemo<SchemaDraftState>(
    () => ({
      isDraftMode,
      draft,
      pendingCount: draft?.items.length ?? 0,
      itemFor,
      isStaged: (kind, id) => itemFor(kind, id) !== undefined,
      stage: async (kind, itemId, op, payload) => {
        await stageMutation.mutateAsync({ kind, itemId, op, payload });
      },
      unstage: async (kind, itemId) => {
        await unstageMutation.mutateAsync({ kind, itemId });
      },
      stageCreate: async (kind, body) => {
        const itemId = crypto.randomUUID();
        await stageMutation.mutateAsync({ kind, itemId, op: 'create', payload: body });
        return itemId;
      },
      stageUpdate: async (kind, itemId, body) => {
        const op = itemFor(kind, itemId)?.op === 'create' ? 'create' : 'update';
        await stageMutation.mutateAsync({ kind, itemId, op, payload: body });
      },
      stageDelete: async (kind, itemId) => {
        if (itemFor(kind, itemId)?.op === 'create') {
          await unstageMutation.mutateAsync({ kind, itemId });
        } else {
          await stageMutation.mutateAsync({ kind, itemId, op: 'delete' });
        }
      }
    }),
    [isDraftMode, draft, itemFor, stageMutation, unstageMutation]
  );
};
