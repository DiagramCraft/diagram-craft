import type { DatabaseAdapter } from '../../db/database';
import type { SnapshotVersionKind } from './db/schemaDraftDatabase';

/** Marks the stored original state of an item whose history started after it was created. */
export const BASELINE_SUMMARY = 'Original state';

/**
 * Records a version of an enum, field group or category. Those kinds only have a version history
 * from the moment this existed, so items created earlier have no version for their original
 * state. Before the first update, `baseline` is stored as a version of its own; otherwise the
 * oldest version a rollback could restore would already include that first change.
 */
export const recordSnapshotVersion = async (
  db: DatabaseAdapter,
  kind: SnapshotVersionKind,
  ws: string,
  row: { id: string },
  ctx: { userId: string; publicationId?: string | null },
  baseline?: { id: string }
) => {
  if (baseline) {
    const existing = await db.schemaDraft.listSnapshotVersions(kind, ws, baseline.id);
    if (existing.length === 0) {
      await db.schemaDraft.createSnapshotVersion(kind, {
        workspace: ws,
        item_id: baseline.id,
        snapshot: baseline,
        change_summary: BASELINE_SUMMARY,
        publication_id: null,
        created_by: null
      });
    }
  }
  await db.schemaDraft.createSnapshotVersion(kind, {
    workspace: ws,
    item_id: row.id,
    snapshot: row,
    change_summary: null,
    publication_id: ctx.publicationId ?? null,
    created_by: ctx.userId
  });
};
