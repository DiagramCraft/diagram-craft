import { orpcAssert } from '../../utils/orpcAssert';
import type { EntityVersionDbResult } from './db/catalogDatabase';
import {
  filterRestrictedFieldGroups,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

export const redactVersionState = (
  version: EntityVersionDbResult,
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null
): EntityVersionDbResult => {
  const data = version.state['data'];
  if (data == null || typeof data !== 'object') return version;
  return {
    ...version,
    state: {
      ...version.state,
      data: filterRestrictedFieldGroups(authCtx, schema, data as Record<string, unknown>)
    }
  };
};

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
