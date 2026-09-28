import { describe, expect, it } from 'vitest';
import { parseKnownDashboardWidget } from './dashboardWidgetConfig';
import { getWidgetTitle } from './dashboardWidgetDefaults';
import { getDashboardWidgetSpec } from './dashboardWidgetRegistry';

describe('parseKnownDashboardWidget', () => {
  it('parses a built-in widget with nested config', () => {
    const widget = parseKnownDashboardWidget({
      id: 'metric',
      type: 'Metric',
      config: { metricType: 'entity-count', label: 'Entities' },
      x: 0,
      y: 0,
      w: 3,
      h: 2
    });

    expect(widget?.type).toBe('Metric');
    expect(widget?.config).toEqual({ metricType: 'entity-count', label: 'Entities' });
  });

  it('parses a Markdown widget with title and content', () => {
    const widget = parseKnownDashboardWidget({
      id: 'markdown',
      type: 'markdown',
      config: { title: 'Notes', markdown: '# Heading\n\nBody' },
      x: 0,
      y: 0,
      w: 6,
      h: 4
    });

    expect(widget?.type).toBe('markdown');
    expect(widget?.config).toEqual({ title: 'Notes', markdown: '# Heading\n\nBody' });
  });

  it('parses a wiki page widget with a selected page', () => {
    const widget = parseKnownDashboardWidget({
      id: 'wiki-page',
      type: 'wiki-page',
      config: { nodeId: 'wiki-1' },
      x: 0,
      y: 0,
      w: 6,
      h: 6
    });

    expect(widget?.type).toBe('wiki-page');
  });

  it('rejects a wiki page widget without a selected page', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'wiki-page',
        type: 'wiki-page',
        config: { nodeId: '' },
        x: 0,
        y: 0,
        w: 6,
        h: 6
      })
    ).toBeNull();
  });

  it('rejects a Markdown widget without string title or content', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'markdown',
        type: 'markdown',
        config: { title: 'Notes', markdown: 42 },
        x: 0,
        y: 0,
        w: 6,
        h: 4
      })
    ).toBeNull();
  });

  it('uses the configured Markdown title without deriving it from content', () => {
    expect(
      getWidgetTitle({
        id: 'markdown',
        type: 'markdown',
        config: { title: 'Project notes', markdown: '# Different heading' },
        x: 0,
        y: 0,
        w: 6,
        h: 4
      })
    ).toBe('Project notes');

    expect(
      getWidgetTitle({
        id: 'markdown',
        type: 'markdown',
        config: { title: '  ', markdown: '# Heading' },
        x: 0,
        y: 0,
        w: 6,
        h: 4
      })
    ).toBe('Markdown');
  });

  it('parses an AggregateStat widget with a numerator condition', () => {
    const widget = parseKnownDashboardWidget({
      id: 'aggregate-stat',
      type: 'AggregateStat',
      config: {
        schema: 'compliance_requirement',
        numeratorCondition: { fieldId: 'status', op: 'equals', value: 'met' },
        label: 'Compliance coverage'
      },
      x: 0,
      y: 0,
      w: 3,
      h: 2
    });

    expect(widget?.type).toBe('AggregateStat');
  });

  it('rejects an AggregateStat widget without a schema or numerator condition', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'aggregate-stat',
        type: 'AggregateStat',
        config: { schema: '' },
        x: 0,
        y: 0,
        w: 3,
        h: 2
      })
    ).toBeNull();
  });

  it('parses a query-mode AggregateStat and rejects percent without a denominator', () => {
    const base = { id: 'stat', type: 'AggregateStat', x: 0, y: 0, w: 3, h: 2 };
    expect(
      parseKnownDashboardWidget({
        ...base,
        config: {
          query: 'schema:"Data Flow"',
          subtextQuery: 'schema:"Data Flow"',
          severity: { warnAt: 1 }
        }
      })?.type
    ).toBe('AggregateStat');
    expect(
      parseKnownDashboardWidget({
        ...base,
        config: { query: 'schema:"Control"', display: 'percent' }
      })
    ).toBeNull();
    expect(
      parseKnownDashboardWidget({
        ...base,
        config: {
          query: 'schema:"Control"',
          display: 'percent',
          denominatorQuery: 'schema:"Control"'
        }
      })?.type
    ).toBe('AggregateStat');
    expect(parseKnownDashboardWidget({ ...base, config: { query: '' } })).toBeNull();
  });

  it('parses a TopEntities widget with a sort field', () => {
    const widget = parseKnownDashboardWidget({
      id: 'top-entities',
      type: 'TopEntities',
      config: { schema: 'risk', fieldId: 'residual_risk_score', direction: 'desc', limit: 5 },
      x: 0,
      y: 0,
      w: 4,
      h: 4
    });

    expect(widget?.type).toBe('TopEntities');
  });

  it('rejects a TopEntities widget without a field or valid direction', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'top-entities',
        type: 'TopEntities',
        config: { schema: 'risk', fieldId: '', direction: 'sideways', limit: 5 },
        x: 0,
        y: 0,
        w: 4,
        h: 4
      })
    ).toBeNull();
  });

  it('parses an Assessments widget with a mode and no assessment type filter', () => {
    const widget = parseKnownDashboardWidget({
      id: 'assessments',
      type: 'Assessments',
      config: { mode: 'overdue' },
      x: 0,
      y: 0,
      w: 3,
      h: 3
    });

    expect(widget?.type).toBe('Assessments');
  });

  it('rejects an Assessments widget with an invalid mode or non-string assessment type', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'assessments',
        type: 'Assessments',
        config: { mode: 'invalid', assessmentTypeId: 42 },
        x: 0,
        y: 0,
        w: 3,
        h: 3
      })
    ).toBeNull();
  });

  it('uses the configured assessment label and falls back to Assessments', () => {
    expect(
      getWidgetTitle({
        id: 'assessments',
        type: 'Assessments',
        config: { mode: 'active', label: 'Reviews' },
        x: 0,
        y: 0,
        w: 3,
        h: 3
      })
    ).toBe('Reviews');
    expect(
      getWidgetTitle({
        id: 'assessments',
        type: 'Assessments',
        config: { mode: 'active', label: '  ' },
        x: 0,
        y: 0,
        w: 3,
        h: 3
      })
    ).toBe('Assessments');
  });

  it('returns null for unknown widget types', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'custom',
        type: 'custom-widget',
        config: { enabled: true },
        x: 0,
        y: 0,
        w: 3,
        h: 2
      })
    ).toBeNull();
  });

  it('returns null for invalid known-widget config', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'metric',
        type: 'Metric',
        config: { metricType: 'not-a-metric' },
        x: 0,
        y: 0,
        w: 3,
        h: 2
      })
    ).toBeNull();
  });

  it('registers the API Catalog pilot widgets for workspace dashboards', () => {
    const pilotWidgets = [
      {
        type: 'api-integration-catalog-stats',
        title: 'API catalog stats',
        config: {},
        width: 12,
        height: 5
      },
      {
        type: 'api-integration-catalog-needs-attention',
        title: 'Needs attention',
        config: { limit: 8 },
        width: 6,
        height: 16
      },
      {
        type: 'api-integration-catalog-most-consumed',
        title: 'Most consumed APIs',
        config: { limit: 6 },
        width: 6,
        height: 16
      },
      {
        type: 'api-integration-catalog-at-risk',
        title: 'Integrations needing attention',
        config: { limit: 8 },
        width: 6,
        height: 16
      },
      {
        type: 'blast-radius',
        title: 'Blast radius',
        config: {},
        width: 6,
        height: 16
      }
    ];

    for (const { type, title, config, width, height } of pilotWidgets) {
      const spec = getDashboardWidgetSpec(type);
      expect(spec).toBeDefined();
      expect(spec?.surfaces).toEqual(['workspace']);
      expect(spec?.icon).toBeDefined();
      expect(spec?.label).toBe(title);
      expect(spec?.defaultW).toBe(width);
      expect(spec?.defaultH).toBe(height);
      expect(spec?.configForm).toBeDefined();
      expect(spec?.createDefaultConfig({})).toEqual(config);
      expect(spec?.isValidConfig(config)).toBe(true);
      expect(getWidgetTitle({ id: type, type, config, x: 0, y: 0, w: 6, h: 4 })).toBe(title);
      expect(
        parseKnownDashboardWidget({ id: type, type, config, x: 0, y: 0, w: 6, h: 4 })
      ).not.toBeNull();
    }
  });

  it('validates API Catalog widget titles and visible-item limits', () => {
    expect(
      parseKnownDashboardWidget({
        id: 'needs-attention',
        type: 'api-integration-catalog-needs-attention',
        config: { label: 'Queue', limit: 1 },
        x: 0,
        y: 0,
        w: 6,
        h: 4
      })
    ).not.toBeNull();

    for (const limit of [0, 21, 1.5, '8']) {
      expect(
        parseKnownDashboardWidget({
          id: 'needs-attention',
          type: 'api-integration-catalog-needs-attention',
          config: { limit },
          x: 0,
          y: 0,
          w: 6,
          h: 4
        })
      ).toBeNull();
    }

    expect(
      parseKnownDashboardWidget({
        id: 'stats',
        type: 'api-integration-catalog-stats',
        config: { label: 42 },
        x: 0,
        y: 0,
        w: 12,
        h: 2
      })
    ).toBeNull();
  });
});

describe('api integration catalog widget frames', () => {
  it('hides the stats frame outside edit mode and removes body padding', () => {
    expect(getDashboardWidgetSpec('api-integration-catalog-stats')?.frame).toEqual({
      hideOutsideEdit: true,
      padded: false,
      showIcon: false
    });
  });

  it.each([
    'api-integration-catalog-needs-attention',
    'api-integration-catalog-most-consumed',
    'api-integration-catalog-at-risk'
  ])('%s has an unpadded body and header actions', type => {
    const spec = getDashboardWidgetSpec(type);
    expect(spec?.frame).toEqual({ padded: false, showIcon: false });
    expect(spec?.headerActionsComponent).toBeDefined();
  });
});
