import { describe, expect, it } from 'vitest';
import type { DashboardSidebarConfig } from '@arch-register/api-types/dashboardContract';
import { computeSidebarVariables } from './dashboardSidebarVariables';

describe('computeSidebarVariables', () => {
  it('returns an empty map when there is no sidebar', () => {
    expect(computeSidebarVariables(undefined, { apiEntityId: 'API-1' })).toEqual({});
  });

  describe('entity-picker', () => {
    const sidebar: DashboardSidebarConfig = {
      kind: 'entity-picker',
      schemaName: 'API',
      variableName: 'apiEntityId'
    };

    it('resolves the selected value', () => {
      expect(computeSidebarVariables(sidebar, { apiEntityId: 'API-1' })).toEqual({
        apiEntityId: 'API-1'
      });
    });

    it('leaves the variable absent (not empty-string) when nothing is selected', () => {
      expect(computeSidebarVariables(sidebar, {})).toEqual({});
    });
  });

  describe('options', () => {
    const sidebar: DashboardSidebarConfig = {
      kind: 'options',
      variableName: 'status',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'completed', label: 'Completed' }
      ]
    };

    it('resolves the selected option value', () => {
      expect(computeSidebarVariables(sidebar, { status: 'open' })).toEqual({ status: 'open' });
    });

    it('defaults to an empty string when nothing is selected', () => {
      expect(computeSidebarVariables(sidebar, {})).toEqual({ status: '' });
    });
  });

  describe('facets', () => {
    const sidebar: DashboardSidebarConfig = {
      kind: 'facets',
      schemaName: 'Term',
      facets: [
        { fieldId: 'Categories', variableName: 'categoryIds' },
        { fieldId: '_owner', variableName: 'ownerIds' }
      ]
    };

    it('resolves selected facet values', () => {
      expect(computeSidebarVariables(sidebar, { categoryIds: 'c1,c2', ownerIds: 'o1' })).toEqual({
        categoryIds: 'c1,c2',
        ownerIds: 'o1'
      });
    });

    it('defaults every unselected facet to an empty string, not absent', () => {
      expect(computeSidebarVariables(sidebar, {})).toEqual({ categoryIds: '', ownerIds: '' });
    });

    it('defaults only the unselected facets when some are selected', () => {
      expect(computeSidebarVariables(sidebar, { categoryIds: 'c1' })).toEqual({
        categoryIds: 'c1',
        ownerIds: ''
      });
    });
  });
});
