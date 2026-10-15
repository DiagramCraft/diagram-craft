import { describe, expect, it } from 'vitest';
import { TbChartBar, TbLayoutDashboard } from 'react-icons/tb';
import '../../../componentDiscovery';
import {
  createDefaultConfig,
  getComponentDefinition,
  getComponentDefinitions,
  getWikiMdxComponents
} from './componentRegistry';

/** MDX components that can also be added to a dashboard. */
const dashboardMdxComponents = () =>
  Object.fromEntries(
    getComponentDefinitions('mdx')
      .filter(definition => definition.dashboardWidget)
      .map(definition => [definition.type, definition])
  );

describe('wiki and dashboard component availability', () => {
  it('includes components with an MDX registration for "wiki"', () => {
    const wiki = getWikiMdxComponents();
    expect(wiki['EntityViewEmbed']).toBeDefined();
    expect(wiki['EntityChart']).toBeDefined();
    expect(wiki['Metric']).toBeDefined();
    expect(wiki['EntityTable']).toBeDefined();
    expect(wiki['DiagramEmbed']).toBeDefined();
  });

  it('excludes dashboard-only components for "wiki"', () => {
    const wiki = getWikiMdxComponents();
    expect(wiki['entity-lifecycle-chart']).toBeUndefined();
    expect(wiki['entity-activity-trend-chart']).toBeUndefined();
    expect(wiki['entity-stale-report']).toBeUndefined();
    expect(wiki['markdown']).toBeUndefined();
  });

  it('includes MDX components that are also available as dashboard widgets', () => {
    const dashboard = dashboardMdxComponents();
    expect(dashboard['entity-lifecycle-chart']).toBeUndefined();
    expect(dashboard['entity-activity-trend-chart']).toBeUndefined();
    expect(dashboard['entity-stale-report']).toBeUndefined();
    expect(dashboard['EntityViewEmbed']).toBeDefined();
    expect(dashboard['markdown']).toBeUndefined();
  });

  it('excludes wiki-only components for "dashboard"', () => {
    const dashboard = dashboardMdxComponents();
    expect(dashboard['Callout']).toBeUndefined();
  });

  it('keeps the dashboard-only wiki page widget out of wiki rendering', () => {
    expect(getWikiMdxComponents()['wiki-page']).toBeUndefined();
  });

  it('keeps one shared icon on every dashboard widget and slash-command definition', () => {
    const catalogued = getComponentDefinitions().filter(
      definition => definition.dashboardWidget || definition.mdx?.editorSpec?.slashCommand
    );

    expect(catalogued.length).toBeGreaterThan(0);
    for (const definition of catalogued) {
      expect(definition.icon, definition.type).toBeDefined();
      if (definition.dashboardWidget) {
        expect(definition.dashboardWidget, definition.type).not.toHaveProperty('icon');
      }
      const slashCommand = definition.mdx?.editorSpec?.slashCommand;
      if (slashCommand) expect(slashCommand, definition.type).not.toHaveProperty('icon');
    }
  });

  it('uses the dashboard icons for components that previously differed by surface', () => {
    expect(getComponentDefinition('Metric')?.icon).toBe(TbChartBar);
    expect(getComponentDefinition('EntityViewEmbed')?.icon).toBe(TbLayoutDashboard);
  });

  it('keeps dashboard-only widgets in the dashboard catalog', () => {
    const widgets = getComponentDefinitions('dashboardWidget');
    expect(widgets.some(widget => widget.type === 'markdown')).toBe(true);
    expect(widgets.some(widget => widget.type === 'wiki-page')).toBe(true);
    expect(getComponentDefinition('markdown', 'dashboardWidget')?.dashboardWidget).toBeDefined();
    expect(getComponentDefinition('Callout', 'dashboardWidget')).toBeUndefined();
  });

  it('never returns more entries than the full registry', () => {
    expect(Object.keys(getWikiMdxComponents()).length).toBeLessThanOrEqual(
      getComponentDefinitions('mdx').length
    );
    expect(Object.keys(dashboardMdxComponents()).length).toBeLessThanOrEqual(
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
      definition?.mdx.mapProps?.({ config: 'invalid' }, createDefaultConfig(definition, {}))
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

    expect(createDefaultConfig(staleReport!, {})).toEqual({});
    expect(createDefaultConfig(activityTrend!, {})).toEqual({});
    expect(Object.hasOwn(staleReport?.dashboardWidget ?? {}, 'mapConfigToProps')).toBe(false);
    expect(Object.hasOwn(activityTrend?.dashboardWidget ?? {}, 'mapConfigToProps')).toBe(false);
  });
});
