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
