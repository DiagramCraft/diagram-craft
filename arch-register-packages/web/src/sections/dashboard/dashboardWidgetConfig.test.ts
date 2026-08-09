import { describe, expect, it } from 'vitest';
import { parseKnownDashboardWidget } from './dashboardWidgetConfig';
import { getWidgetTitle } from './dashboardWidgetDefaults';

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
});
