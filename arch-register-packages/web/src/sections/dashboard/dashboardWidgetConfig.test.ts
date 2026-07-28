import { describe, expect, it } from 'vitest';
import { parseKnownDashboardWidget } from './dashboardWidgetConfig';

describe('parseKnownDashboardWidget', () => {
  it('parses a built-in widget with nested config', () => {
    const widget = parseKnownDashboardWidget({
      id: 'metric',
      type: 'stat-metric',
      config: { metricType: 'entity-count', label: 'Entities' },
      x: 0,
      y: 0,
      w: 3,
      h: 2
    });

    expect(widget?.type).toBe('stat-metric');
    expect(widget?.config).toEqual({ metricType: 'entity-count', label: 'Entities' });
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
        type: 'stat-metric',
        config: { metricType: 'not-a-metric' },
        x: 0,
        y: 0,
        w: 3,
        h: 2
      })
    ).toBeNull();
  });
});
