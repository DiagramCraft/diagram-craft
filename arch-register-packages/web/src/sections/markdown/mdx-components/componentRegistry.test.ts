import { describe, expect, it } from 'vitest';
import '../../../componentDiscovery';
import {
  getComponentDefinition,
  getComponentDefinitions,
  getMdxComponentDefinitionsForSurface
} from './componentRegistry';

describe('getMdxComponentDefinitionsForSurface', () => {
  it('includes wiki-eligible components (surfaces unset or including "wiki") for "wiki"', () => {
    const wiki = getMdxComponentDefinitionsForSurface('wiki');
    expect(wiki['EntityViewEmbed']).toBeDefined();
    expect(wiki['EntityChart']).toBeDefined();
    expect(wiki['Metric']).toBeDefined();
    expect(wiki['EntityTable']).toBeDefined();
    expect(wiki['DiagramEmbed']).toBeDefined();
  });

  it('excludes dashboard-only components for "wiki"', () => {
    const wiki = getMdxComponentDefinitionsForSurface('wiki');
    expect(wiki['entity-lifecycle-chart']).toBeUndefined();
    expect(wiki['entity-activity-trend-chart']).toBeUndefined();
    expect(wiki['entity-stale-report']).toBeUndefined();
    expect(wiki['markdown']).toBeUndefined();
  });

  it('includes MDX components that are also available as dashboard widgets', () => {
    const dashboard = getMdxComponentDefinitionsForSurface('dashboard');
    expect(dashboard['entity-lifecycle-chart']).toBeUndefined();
    expect(dashboard['entity-activity-trend-chart']).toBeUndefined();
    expect(dashboard['entity-stale-report']).toBeUndefined();
    expect(dashboard['EntityViewEmbed']).toBeDefined();
    expect(dashboard['markdown']).toBeUndefined();
  });

  it('excludes wiki-only components for "dashboard"', () => {
    const dashboard = getMdxComponentDefinitionsForSurface('dashboard');
    expect(dashboard['Callout']).toBeUndefined();
  });

  it('keeps the dashboard-only wiki page widget out of wiki rendering', () => {
    expect(getMdxComponentDefinitionsForSurface('wiki')['wiki-page']).toBeUndefined();
  });

  it('keeps dashboard-only widgets in the dashboard catalog', () => {
    const widgets = getComponentDefinitions('dashboardWidget');
    expect(widgets.some(widget => widget.type === 'markdown')).toBe(true);
    expect(widgets.some(widget => widget.type === 'wiki-page')).toBe(true);
    expect(getComponentDefinition('markdown', 'dashboardWidget')?.dashboardWidget).toBeDefined();
    expect(getComponentDefinition('Callout', 'dashboardWidget')).toBeUndefined();
  });

  it('never returns more entries than the full registry', () => {
    expect(Object.keys(getMdxComponentDefinitionsForSurface('wiki')).length).toBeLessThanOrEqual(
      getComponentDefinitions('mdx').length
    );
    expect(Object.keys(getMdxComponentDefinitionsForSurface('dashboard')).length).toBeLessThanOrEqual(
      getComponentDefinitions('mdx').length
    );
  });

  it('keeps the shared renderer and config form at the definition root', () => {
    const definition = getComponentDefinition('EntityTable', 'mdx');
    const dashboardOnly = getComponentDefinition('ChangeCaseTable', 'dashboardWidget');

    expect(definition?.component).toBeDefined();
    expect(definition?.configForm).toBeDefined();
    expect(definition?.dashboardWidget).toBeDefined();
    expect(definition?.mdx).not.toHaveProperty('component');
    expect(Object.hasOwn(definition?.dashboardWidget ?? {}, 'component')).toBe(false);
    expect(Object.hasOwn(definition?.dashboardWidget ?? {}, 'configForm')).toBe(false);
    expect(dashboardOnly?.component).toBeDefined();
    expect(dashboardOnly?.configForm).toBeDefined();
    expect(Object.hasOwn(dashboardOnly?.dashboardWidget ?? {}, 'component')).toBe(false);
    expect(Object.hasOwn(dashboardOnly?.dashboardWidget ?? {}, 'configForm')).toBe(false);
  });

  it('adapts flat MDX attributes to typed component configs', () => {
    const definition = getComponentDefinition('EntityTable', 'mdx');

    expect(definition?.mdx.mapProps?.({ schema: 'service', limit: '12' }, {})).toEqual({
      config: { schema: 'service', owner: undefined, lifecycle: undefined, limit: 12 }
    });
  });

  it('decodes encoded browser config at the MDX boundary', () => {
    const definition = getComponentDefinition('EntityBrowserEmbed', 'mdx');

    expect(
      definition?.mdx.mapProps?.({ config: 'invalid' }, definition?.createDefaultProps?.({}) ?? {})
    ).toEqual({
      config: {
        q: '',
        conditions: [],
        sort: 'name',
        view: 'table',
        viewConfigs: {}
      }
    });
  });

  it('passes dashboard configs directly to widget components', () => {
    const staleReport = getComponentDefinition('entity-stale-report', 'dashboardWidget');
    const activityTrend = getComponentDefinition('entity-activity-trend-chart', 'dashboardWidget');

    expect(staleReport?.createDefaultProps({})).toEqual({ config: {} });
    expect(activityTrend?.createDefaultProps({})).toEqual({ config: {} });
    expect(Object.hasOwn(staleReport?.dashboardWidget ?? {}, 'mapConfigToProps')).toBe(false);
    expect(Object.hasOwn(activityTrend?.dashboardWidget ?? {}, 'mapConfigToProps')).toBe(false);
  });
});
