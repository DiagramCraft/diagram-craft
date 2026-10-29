import { describe, expect, it } from 'vitest';
import {
  dashboardSidebarConfigSchema,
  updateDashboardBodySchema
} from '@arch-register/api-types/dashboardContract';

describe('dashboardSidebarConfigSchema', () => {
  it('accepts an entity-picker sidebar (backward-compatible shape)', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'entity-picker',
      schemaName: 'API',
      variableName: 'apiEntityId',
      itemLabel: 'APIs'
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.kind).toBe('entity-picker');
  });

  it('accepts an entity-picker sidebar without the optional itemLabel', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'entity-picker',
      schemaName: 'API',
      variableName: 'apiEntityId'
    });
    expect(result.success).toBe(true);
  });

  it('accepts a facets sidebar with a reference-field and a standard-field facet', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'facets',
      schemaName: 'Term',
      facets: [
        { fieldId: 'categories', variableName: 'categoryIds', itemLabel: 'Category' },
        { fieldId: '_owner', variableName: 'ownerIds', itemLabel: 'Owner' },
        { fieldId: '_lifecycle', variableName: 'lifecycleIds' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.kind === 'facets' && result.data.facets).toHaveLength(3);
  });

  it('accepts an options sidebar with fixed value/label pairs', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'options',
      variableName: 'status',
      itemLabel: 'Status',
      allLabel: 'All change cases',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'completed', label: 'Completed' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.kind).toBe('options');
  });

  it('rejects an options sidebar with no options or an empty option value', () => {
    expect(
      dashboardSidebarConfigSchema.safeParse({
        kind: 'options',
        variableName: 'status',
        options: []
      }).success
    ).toBe(false);
    expect(
      dashboardSidebarConfigSchema.safeParse({
        kind: 'options',
        variableName: 'status',
        options: [{ value: '', label: 'Nothing' }]
      }).success
    ).toBe(false);
  });

  it('rejects a facets sidebar with an empty facets array', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'facets',
      schemaName: 'Term',
      facets: []
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'something-else',
      schemaName: 'API',
      variableName: 'apiEntityId'
    });
    expect(result.success).toBe(false);
  });

  it('rejects mixing fields across kinds (e.g. facets kind with variableName instead of facets)', () => {
    const result = dashboardSidebarConfigSchema.safeParse({
      kind: 'facets',
      schemaName: 'Term',
      variableName: 'apiEntityId'
    });
    expect(result.success).toBe(false);
  });
});

describe('updateDashboardBodySchema sidebar field', () => {
  it('accepts a facets sidebar, null (to remove), and omission (to leave unchanged)', () => {
    expect(
      updateDashboardBodySchema.safeParse({
        sidebar: {
          kind: 'facets',
          schemaName: 'Term',
          facets: [{ fieldId: 'categories', variableName: 'categoryIds' }]
        }
      }).success
    ).toBe(true);
    expect(updateDashboardBodySchema.safeParse({ sidebar: null }).success).toBe(true);
    expect(updateDashboardBodySchema.safeParse({}).success).toBe(true);
  });
});
