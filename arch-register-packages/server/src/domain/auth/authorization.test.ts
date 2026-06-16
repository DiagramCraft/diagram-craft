import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { HTTPError } from 'h3';
import { filterVisibleEntities, requireSchemaRead } from './authorization';

const now = new Date('2026-06-16T12:00:00.000Z');

const schema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Application',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  created_at: now,
  updated_at: now
};

const publicEntity = {
  id: 'entity-public',
  workspace: 'ws-1',
  slug: 'public-app',
  namespace: 'default',
  name: 'Public App',
  description: '',
  owner: null,
  lifecycle: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  visibility_mode: 'public' as const,
  created_at: now,
  updated_at: now
};

const restrictedEntity = {
  ...publicEntity,
  id: 'entity-restricted',
  slug: 'restricted-app',
  name: 'Restricted App',
  visibility_mode: 'restricted' as const
};

describe('authorization helpers', () => {
  it('filters entities to those the caller can view', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      schemas: [schema],
      entities: [publicEntity, restrictedEntity],
      grants: []
    });

    expect(filterVisibleEntities(context, [publicEntity, restrictedEntity]).map(e => e.id)).toEqual(
      ['entity-public']
    );
  });

  it('requires schema read access via workspace view capability', () => {
    const deniedContext = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      schemas: [],
      entities: [],
      grants: []
    });

    expect(() => requireSchemaRead(deniedContext)).toThrowError(HTTPError);

    const allowedContext = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'viewer',
      schemas: [],
      entities: [],
      grants: []
    });

    expect(() => requireSchemaRead(allowedContext)).not.toThrow();
  });
});
