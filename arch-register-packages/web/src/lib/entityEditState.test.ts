import { describe, expect, it } from 'vitest';
import {
  createEntityEditState,
  createEntityUpdateBody,
  requiredEntityFieldIds,
  slugifyEntityName
} from './entityEditState';

const schema = {
  id: 'service',
  fields: [
    { id: 'owner', type: 'text', requirementLevel: 'required' },
    { id: 'dependsOn', type: 'reference', requirementLevel: 'required', schemaId: 'service' }
  ]
} as never;

const links = [{ url: 'https://example.test', title: 'Runbook', type: 'runbook' }];

const entity = {
  _schema: { id: 'service' },
  _name: 'Payments API',
  _slug: 'payments-api',
  _description: 'Processes payments',
  _namespace: 'platform',
  _owner: { id: 'team-a' },
  _lifecycle: { id: 'active' },
  _targetLifecycle: null,
  _targetLifecycleDate: null,
  _tags: ['critical', 'pci'],
  _links: links,
  owner: 'Platform',
  dependsOn: ['entity-1', 42]
} as never;

describe('entity detail edit state', () => {
  it('initializes metadata and normalizes relation values', () => {
    expect(createEntityEditState(entity, schema)).toMatchObject({
      _name: 'Payments API',
      _tags: 'critical, pci',
      owner: 'Platform',
      dependsOn: ['entity-1']
    });
  });

  it('finds missing required scalar and relation fields', () => {
    expect([...requiredEntityFieldIds({ owner: '  ', dependsOn: [] }, schema)]).toEqual([
      'owner',
      'dependsOn'
    ]);
  });

  it('serializes the update payload without empty links', () => {
    const body = createEntityUpdateBody(
      entity,
      schema,
      {
        ...createEntityEditState(entity, schema),
        _tags: 'critical,  new ',
        dependsOn: ['entity-2']
      },
      [...links, { url: '', title: '', type: '' }]
    );
    expect(body).toMatchObject({ _tags: ['critical', 'new'], dependsOn: ['entity-2'] });
    expect(body._links).toEqual(links);
  });

  it('serializes empty optional references as null', () => {
    const body = createEntityUpdateBody(
      entity,
      schema,
      {
        ...createEntityEditState(entity, schema),
        _owner: '',
        _lifecycle: '',
        _targetLifecycle: '',
        _targetLifecycleDate: ''
      },
      links
    );

    expect(body).toMatchObject({
      _owner: null,
      _lifecycle: null,
      _targetLifecycle: null,
      _targetLifecycleDate: null
    });
  });

  it('creates stable slugs from names', () => {
    expect(slugifyEntityName('Payments & Billing API')).toBe('payments-billing-api');
  });
});
