import { describe, expect, it } from 'vitest';
import {
  activityAuditSearch,
  completenessSearch,
  lifecycleSearch,
  ownershipGapSearch,
  schemaLifecycleSearch
} from './workspaceAnalyticsHelpers';

describe('workspaceAnalyticsHelpers', () => {
  it('builds lifecycle search params for assigned and unassigned buckets', () => {
    expect(lifecycleSearch('production')).toEqual({
      type: undefined,
      status: 'production',
      filters: undefined
    });

    expect(lifecycleSearch(null)).toEqual({
      type: undefined,
      status: undefined,
      filters: JSON.stringify([{ fieldId: '_lifecycle', op: 'empty', value: '' }])
    });
  });

  it('builds schema-specific searches', () => {
    expect(schemaLifecycleSearch('schema-service', 'production')).toEqual({
      type: 'schema-service',
      status: 'production',
      filters: undefined
    });

    expect(ownershipGapSearch('schema-service')).toEqual({
      type: 'schema-service',
      status: undefined,
      filters: JSON.stringify([{ fieldId: '_owner', op: 'empty', value: '' }])
    });
  });

  it('builds completeness bucket filters', () => {
    expect(completenessSearch('schema-service', 'below50')).toEqual({
      type: 'schema-service',
      status: undefined,
      filters: JSON.stringify([{ fieldId: '_completeness', op: 'lt', value: 50 }])
    });

    expect(completenessSearch('schema-service', 'between50And79')).toEqual({
      type: 'schema-service',
      status: undefined,
      filters: JSON.stringify([
        { fieldId: '_completeness', op: 'gt', value: 49 },
        { fieldId: '_completeness', op: 'lt', value: 80 }
      ])
    });
  });

  it('builds an audit-log drill-down for an activity bucket', () => {
    expect(
      activityAuditSearch('update', '2026-01-01T00:00:00.000Z', '2026-01-01T23:59:59.999Z')
    ).toEqual({
      auditEntityType: 'entity',
      auditOperation: 'update',
      auditStartDate: '2026-01-01T00:00:00.000Z',
      auditEndDate: '2026-01-01T23:59:59.999Z'
    });
  });
});
