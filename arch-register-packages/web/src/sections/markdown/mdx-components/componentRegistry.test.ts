import { describe, expect, it } from 'vitest';
import './componentRegistrations';
import {
  getComponentDefinition,
  getComponentDefinitions,
  getMdxSpecsForSurface
} from './componentRegistry';

describe('getMdxSpecsForSurface', () => {
  it('includes wiki-eligible components (surfaces unset or including "wiki") for "wiki"', () => {
    const wiki = getMdxSpecsForSurface('wiki');
    expect(wiki['EntityViewEmbed']).toBeDefined();
    expect(wiki['EntityChart']).toBeDefined();
    expect(wiki['Metric']).toBeDefined();
    expect(wiki['EntityTable']).toBeDefined();
    expect(wiki['DiagramEmbed']).toBeDefined();
  });

  it('excludes dashboard-only components for "wiki"', () => {
    const wiki = getMdxSpecsForSurface('wiki');
    expect(wiki['entity-lifecycle-chart']).toBeUndefined();
    expect(wiki['entity-activity-trend-chart']).toBeUndefined();
    expect(wiki['entity-stale-report']).toBeUndefined();
    expect(wiki['markdown']).toBeUndefined();
  });

  it('includes MDX components that are also available as dashboard widgets', () => {
    const dashboard = getMdxSpecsForSurface('dashboard');
    expect(dashboard['entity-lifecycle-chart']).toBeUndefined();
    expect(dashboard['entity-activity-trend-chart']).toBeUndefined();
    expect(dashboard['entity-stale-report']).toBeUndefined();
    expect(dashboard['EntityViewEmbed']).toBeDefined();
    expect(dashboard['markdown']).toBeUndefined();
  });

  it('excludes wiki-only components for "dashboard"', () => {
    const dashboard = getMdxSpecsForSurface('dashboard');
    expect(dashboard['Callout']).toBeUndefined();
  });

  it('keeps the dashboard-only wiki page widget out of wiki rendering', () => {
    expect(getMdxSpecsForSurface('wiki')['wiki-page']).toBeUndefined();
  });

  it('keeps dashboard-only widgets in the dashboard catalog', () => {
    const widgets = getComponentDefinitions('dashboardWidget');
    expect(widgets.some(widget => widget.type === 'markdown')).toBe(true);
    expect(widgets.some(widget => widget.type === 'wiki-page')).toBe(true);
    expect(getComponentDefinition('markdown', 'dashboardWidget')?.dashboardWidget).toBeDefined();
    expect(getComponentDefinition('Callout', 'dashboardWidget')).toBeUndefined();
  });

  it('never returns more entries than the full registry', () => {
    expect(Object.keys(getMdxSpecsForSurface('wiki')).length).toBeLessThanOrEqual(
      getComponentDefinitions('mdx').length
    );
    expect(Object.keys(getMdxSpecsForSurface('dashboard')).length).toBeLessThanOrEqual(
      getComponentDefinitions('mdx').length
    );
  });
});
