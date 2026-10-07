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
  DATA_STEWARDSHIP_CLASSIFICATION_APP_KEY,
  DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY,
  RISK_COMPLIANCE_ASSESSMENTS_APP_KEY,
  STRATEGY_CAPABILITY_MAP_APP_KEY,
  STRATEGY_CAPABILITIES_APP_KEY,
  STRATEGY_STRATEGY_APP_KEY,
  STRATEGY_OVERVIEW_APP_KEY,
  RISK_COMPLIANCE_OVERVIEW_APP_KEY,
  RISK_COMPLIANCE_RETENTION_APP_KEY,
  RISK_COMPLIANCE_CONTROLS_APP_KEY,
  RISK_COMPLIANCE_RISKS_APP_KEY
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

  it('seeds the risk & compliance Assessments dashboard with two due lists and a tabbed progress table, no sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[RISK_COMPLIANCE_ASSESSMENTS_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'Assessments',
      'Assessments',
      'tabs'
    ]);
    expect(seed!.widgets.slice(0, 2).map(widget => widget.config.schemaNames)).toEqual([
      ['Risk'],
      ['Control']
    ]);
  });

  it('seeds the strategy Overview dashboard with two breakdowns, two stat tiles and a gaps table, no sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[STRATEGY_OVERVIEW_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toBeUndefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'CountByField',
      'CountByField',
      'AggregateStat',
      'AggregateStat',
      'EntityBrowserEmbed'
    ]);
  });

  it('seeds the strategy Capability map dashboard with one map embed and an owner facets sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[STRATEGY_CAPABILITY_MAP_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['EntityBrowserEmbed']);
    // `isValidConfig` for the embed widget rejects a config without these base fields.
    expect(seed!.widgets[0]!.config).toMatchObject({ q: '', conditions: [], sort: 'name' });
    expect(seed!.sidebar).toMatchObject({ kind: 'facets', schemaName: 'Business Capability' });
  });

  it('seeds the strategy Capabilities dashboard with one tree embed and an Owner facet', () => {
    const seed = APP_DASHBOARD_SEEDS[STRATEGY_CAPABILITIES_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['EntityBrowserEmbed']);
    // `isValidConfig` for the embed widget rejects a config without these base fields.
    expect(seed!.widgets[0]!.config).toMatchObject({
      q: '',
      conditions: [],
      sort: 'name',
      view: 'tree'
    });
    expect(seed!.sidebar).toMatchObject({
      kind: 'facets',
      schemaName: 'Business Capability',
      facets: [{ variableName: 'owners' }]
    });
  });

  it('seeds the strategy Strategy dashboard with an objective card, three related lists and a capability table scoped by an Objective picker', () => {
    const seed = APP_DASHBOARD_SEEDS[STRATEGY_STRATEGY_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual([
      'EntityCard',
      'RelatedEntitiesList',
      'RelatedEntitiesList',
      'RelatedEntitiesList',
      'EntityBrowserEmbed'
    ]);
    for (const widget of seed!.widgets.slice(0, 4)) {
      expect(widget.config).toMatchObject({ entityId: '$objectiveId' });
    }
    expect(seed!.widgets[4]!.config).toMatchObject({
      schemaName: 'Business Capability',
      view: 'table',
      entityQuery: { root: { fieldId: '_id', value: ['$objectiveId'] } }
    });
    expect(seed!.widgets[3]!.config).toMatchObject({
      schemaName: 'Measure',
      viaSchemaName: 'Outcome',
      progressTargetField: 'target_value'
    });
    expect(seed!.sidebar).toMatchObject({
      kind: 'entity-picker',
      schemaName: 'Objective',
      variableName: 'objectiveId',
      valueKind: 'id'
    });
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

  it('seeds the data stewardship Classification dashboard with three tabs and a Classification facets sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[DATA_STEWARDSHIP_CLASSIFICATION_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.sidebar).toEqual({
      kind: 'facets',
      schemaName: 'Data Entity',
      facets: [
        { fieldId: 'Classification', variableName: 'classifications', itemLabel: 'Classification' }
      ]
    });
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['tabs']);
    const tabs = (
      seed!.widgets[0]!.config as {
        tabs: Array<{ id: string; widgets: Array<{ id: string; type: string }> }>;
      }
    ).tabs;
    expect(tabs.map(tab => tab.id)).toEqual(['classified', 'restricted-flows', 'cross-boundary']);
    expect(tabs.map(tab => tab.widgets.map(widget => widget.type))).toEqual([
      ['AggregateStat', 'AggregateStat', 'AggregateStat', 'EntityBrowserEmbed'],
      ['AggregateStat', 'AggregateStat', 'AggregateStat', 'RelationTable'],
      ['AggregateStat', 'AggregateStat', 'AggregateStat', 'RelationTable']
    ]);
    const ids = tabs.flatMap(tab => tab.widgets.map(widget => widget.id));
    expect(new Set(ids).size).toBe(ids.length);
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
      'RatioBarList',
      'Assessments',
      'EntityBrowserEmbed',
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

  it('seeds the risks dashboard with a Register/Matrix tabs widget and a facets sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[RISK_COMPLIANCE_RISKS_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['tabs']);
    const tabs = seed!.widgets[0]!.config.tabs as Array<{
      label: string;
      widgets: Array<{ id: string; type: string; config: Record<string, unknown> }>;
    }>;
    expect(tabs.map(tab => tab.label)).toEqual(['Register', 'Matrix']);
    expect(tabs.map(tab => tab.widgets.map(widget => widget.type))).toEqual([
      ['EntityBrowserEmbed'],
      ['risk-compliance-risk-matrix']
    ]);
    expect(
      tabs.map(tab => tab.widgets.map(widget => widget.config.title ?? widget.config.label))
    ).toEqual([['Risk register'], ['Risk matrix — likelihood × impact']]);
    const ids = tabs.flatMap(tab => tab.widgets.map(widget => widget.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(seed!.sidebar).toMatchObject({
      kind: 'facets',
      schemaName: 'Risk',
      facets: [
        { fieldId: 'Category', variableName: 'categories' },
        { fieldId: 'Status', variableName: 'statuses' },
        { fieldId: 'Risk Owner', variableName: 'owners' }
      ]
    });
  });

  it('seeds the controls dashboard with Library/Coverage/traceability tabs and a facets sidebar', () => {
    const seed = APP_DASHBOARD_SEEDS[RISK_COMPLIANCE_CONTROLS_APP_KEY];
    expect(seed).toBeDefined();
    expect(seed!.widgets.map(widget => widget.type)).toEqual(['tabs']);
    const tabs = seed!.widgets[0]!.config.tabs as Array<{
      label: string;
      widgets: Array<{ id: string; type: string; config: Record<string, unknown> }>;
    }>;
    expect(tabs.map(tab => tab.label)).toEqual([
      'Library',
      'Coverage',
      'Controls × Risks',
      'Controls × Data Entities'
    ]);
    const ids = tabs.flatMap(tab => tab.widgets.map(widget => widget.id));
    expect(new Set(ids).size).toBe(ids.length);
    const traceability = [tabs[2]!.widgets[0]!, tabs[3]!.widgets[0]!];
    expect(traceability.map(widget => widget.config.view)).toEqual(['matrix', 'matrix']);
    for (const widget of traceability) {
      expect(
        (widget.config.viewConfigs as { matrix: Record<string, unknown> }).matrix
      ).toMatchObject({
        cellColorSource: 'row',
        cellColorFieldId: 'Operating Effectiveness'
      });
    }
    expect(seed!.sidebar).toMatchObject({
      kind: 'facets',
      schemaName: 'Control',
      facets: [
        { fieldId: 'Type', variableName: 'types' },
        { fieldId: 'Operating Effectiveness', variableName: 'effectiveness' }
      ]
    });
  });
});
