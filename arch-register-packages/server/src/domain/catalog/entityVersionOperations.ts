import { orpcAssert } from '../../utils/orpcAssert';
import type { EntityVersionDbResult } from './db/catalogDatabase';

export const serializeEntityVersion = (version: EntityVersionDbResult) => ({
  ...version,
  created_at: version.created_at.toISOString(),
  created_by_name: version.created_by_name
});

export const assertVersionCanBeRestored = (version: EntityVersionDbResult, entityId: string) => {
  orpcAssert.true(version.entity_id === entityId, {
    code: 'BAD_REQUEST',
    message: 'Version does not belong to this entity'
  });
  orpcAssert.true(
    version.kind === 'autosave' ||
      version.kind === 'saved_version' ||
      version.kind === 'case_applied',
    {
      code: 'BAD_REQUEST',
      message: 'Only autosave, saved_version, or case_applied versions can be restored'
    }
  );
};
