import { describe, expect, it } from 'vitest';
import { computeChanges, flattenEntityAuditFields } from './auditLogging';
import { EntityDbCreate } from '../../catalog/db/catalogDatabase';

const now = new Date('2026-06-08T10:00:00.000Z');

const makeEntity = (overrides: Partial<EntityDbCreate> = {}): EntityDbCreate => ({
  id: 'e-1',
  workspace: 'ws-1',
  slug: 'entity-1',
  namespace: 'default',
  name: 'Entity 1',
  description: 'Original description',
  owner: 'team-a',
  lifecycle: 'active',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['core'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: {
    region: 'eu',
    criticality: 'high'
  },
  visibility_mode: 'public',
  created_at: now,
  updated_at: now,
  ...overrides
});

describe('flattenEntityAuditFields', () => {
  it('exposes metadata and custom fields as a flat object', () => {
    const entity = makeEntity();

    expect(flattenEntityAuditFields(entity)).toEqual({
      _schemaId: 'schema-1',
      _name: 'Entity 1',
      _slug: 'entity-1',
      _namespace: 'default',
      _description: 'Original description',
      _owner: 'team-a',
      _lifecycle: 'active',
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: ['core'],
      _links: [{ url: 'https://example.com', title: 'Example' }],
      _visibilityMode: 'public',
      region: 'eu',
      criticality: 'high'
    });
  });
});

describe('computeChanges with flattened entity audit fields', () => {
  it('records only the custom field that changed', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({
      data: {
        region: 'us',
        criticality: 'high'
      }
    });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { region: 'eu' },
      new: { region: 'us' }
    });
  });

  it('records only the standard field that changed', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({ owner: 'team-b' });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { _owner: 'team-a' },
      new: { _owner: 'team-b' }
    });
  });

  it('records array fields when they actually change', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({ tags: ['core', 'payments'] });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { _tags: ['core'] },
      new: { _tags: ['core', 'payments'] }
    });
  });
});
