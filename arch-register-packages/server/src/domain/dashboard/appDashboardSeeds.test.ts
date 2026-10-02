import { describe, expect, it } from 'vitest';
import {
  dashboardSidebarConfigSchema,
  dashboardWidgetSchema
} from '@arch-register/api-types/dashboardContract';
import {
  APP_DASHBOARD_SEEDS,
  BUSINESS_GLOSSARY_APP_KEY,
  DATA_STEWARDSHIP_APP_KEY,
  DATA_STEWARDSHIP_ASSESSMENTS_APP_KEY,
  DATA_STEWARDSHIP_CHANGE_CASES_APP_KEY,
  DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY,
  RISK_COMPLIANCE_OVERVIEW_APP_KEY,
  RISK_COMPLIANCE_RETENTION_APP_KEY
} from './appDashboardSeeds';

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

  it('seeds the data stewardship My work dashboard with four stat tiles, a calendar and a queue', () => {
    const seed = APP_DASHBOARD_SEEDS[DATA_STEWARDSHIP_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'data-stewardship-case-count',
      'data-stewardship-case-count',
      'data-stewardship-case-count',
      'data-stewardship-reviews-overdue',
      'data-stewardship-case-calendar',
      'data-stewardship-case-queue'
    ]);
  });

  it('seeds the data stewardship Assessments dashboard with four status tiles and a progress table, no sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[DATA_STEWARDSHIP_ASSESSMENTS_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'AssessmentStatusStat',
      'AssessmentStatusStat',
      'AssessmentStatusStat',
      'AssessmentStatusStat',
      'AssessmentProgressTable'
    ]);
    expect(seed!.widgets.slice(0, 4).map(widget => widget.config.status)).toEqual([
      'overdue',
      'in_progress',
      'not_started',
      'complete'
    ]);
  });

  it('seeds the data stewardship Stewardship dashboard with four coverage tiles and a conformance gaps list, no sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'AggregateStat',
      'AggregateStat',
      'AggregateStat',
      'AggregateStat',
      'ConformanceViolations'
    ]);
    expect(seed!.widgets[4]!.config).toMatchObject({ schemaName: 'Data Entity', limit: 8 });
  });

  it('seeds the data stewardship Change cases dashboard with one change case table and a status options sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[DATA_STEWARDSHIP_CHANGE_CASES_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toEqual({
      kind: 'options',
      variableName: 'status',
      itemLabel: 'Status',
      allLabel: 'All change cases',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    });
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['ChangeCaseTable']);
    expect(seed!.widgets[0]!.config).toMatchObject({
      schemaName: 'Data Entity',
      caseKinds: ['entity.change-case'],
      status: '$status'
    });
  });

  it('seeds the retention dashboard with one entity browser bound to a policy entity-picker', () => {
    const seed = APP_DASHBOARD_SEEDS[RISK_COMPLIANCE_RETENTION_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['EntityBrowserEmbed']);
    expect(seed!.widgets[0]!.config.schemaName).toBe('Data Entity');
    expect(seed!.sidebar).toEqual({
      kind: 'entity-picker',
      schemaName: 'Retention Policy',
      variableName: 'policyId',
      itemLabel: 'Policies',
      valueKind: 'id'
    });
  });

  it('seeds the risk & compliance overview dashboard without a sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[RISK_COMPLIANCE_OVERVIEW_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'AggregateStat',
      'AggregateStat',
      'AssessmentCount',
      'risk-compliance-risk-matrix',
      'EntityBrowserEmbed',
      'RatioBarList',
      'Assessments',
      'EntityBrowserEmbed'
    ]);
    const browsers = seed!.widgets.filter(widget => widget.type === 'EntityBrowserEmbed');
    expect(browsers.map(widget => widget.config.title)).toEqual([
      'Highest residual risks',
      'Risks with weak or missing control'
    ]);
    expect(browsers[0]!.config.limit).toBe(7);
    expect(browsers.map(widget => widget.config.sort)).toEqual([
      'field:Residual Risk Score:desc',
      'field:Residual Risk Score:desc'
    ]);
    const ids = seed!.widgets.map(widget => widget.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
