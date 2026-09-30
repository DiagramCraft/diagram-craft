import { describe, expect, it } from 'vitest';
import {
  dashboardSidebarConfigSchema,
  dashboardWidgetSchema
} from '@arch-register/api-types/dashboardContract';
import { APP_DASHBOARD_SEEDS, BUSINESS_GLOSSARY_APP_KEY } from './appDashboardSeeds';

describe('APP_DASHBOARD_SEEDS', () => {
  it('every seed widget matches the dashboard widget contract', () => {
    for (const [appKey, seed] of Object.entries(APP_DASHBOARD_SEEDS)) {
      for (const widget of seed.widgets) {
        expect(dashboardWidgetSchema.safeParse(widget).success, `${appKey}/${widget.id}`).toBe(
          true
        );
      }
      if (seed.sidebar) {
        expect(
          dashboardSidebarConfigSchema.safeParse(seed.sidebar).success,
          `${appKey} sidebar`
        ).toBe(true);
      }
    }
  });

  it('seeds the business glossary dashboard with one full-width entity-browser-embed widget and a facets sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[BUSINESS_GLOSSARY_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets).toHaveLength(1);
    expect(seed!.widgets[0]!.type).toBe('EntityBrowserEmbed');

    const config = seed!.widgets[0]!.config as {
      schemaName?: string;
      viewConfigs: { table: { fieldIds: string[] } };
      entityQuery: { projections?: { alias?: string }[] };
    };
    expect(config.schemaName).toBe('Term');
    expect(config.viewConfigs.table.fieldIds).toContain('_usageCount');
    expect(config.viewConfigs.table.fieldIds).toContain('_projection:Category');
    expect(config.entityQuery.projections?.[0]?.alias).toBe('Category');

    expect(seed!.sidebar).toEqual({
      kind: 'facets',
      schemaName: 'Term',
      facets: [
        { fieldId: 'Categories', variableName: 'categoryIds', itemLabel: 'Category' },
        { fieldId: '_owner', variableName: 'ownerIds', itemLabel: 'Owner' },
        { fieldId: '_lifecycle', variableName: 'lifecycleIds', itemLabel: 'Lifecycle' }
      ]
    });
  });
});
