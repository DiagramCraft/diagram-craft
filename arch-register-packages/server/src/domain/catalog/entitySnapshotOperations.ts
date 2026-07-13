import { orpcAssert } from '../../utils/orpcAssert';
import type { EntitySnapshotDbResult } from './db/catalogDatabase';

export const serializeEntitySnapshot = (snapshot: EntitySnapshotDbResult) => ({
  ...snapshot,
  created_at: snapshot.created_at.toISOString(),
  created_by_name: snapshot.created_by_name,
  target_date:
    (snapshot.target_date as unknown) instanceof Date
      ? (snapshot.target_date as unknown as Date).toISOString().slice(0, 10)
      : snapshot.target_date
});

export const assertSnapshotCanBeRestored = (snapshot: EntitySnapshotDbResult, entityId: string) => {
  orpcAssert.true(snapshot.entity_id === entityId, {
    code: 'BAD_REQUEST',
    message: 'Snapshot does not belong to this entity'
  });
  orpcAssert.true(
    snapshot.status === 'autosave' ||
      snapshot.status === 'saved_version' ||
      snapshot.status === 'applied',
    {
      code: 'BAD_REQUEST',
      message: 'Only autosave, saved_version, or applied snapshots can be restored'
    }
  );
};
