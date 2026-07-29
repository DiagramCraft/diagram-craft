import { describe, expect, it } from 'vitest';
import { getMdxSpecsForSurface, MDX_COMPONENTS } from './mdxRegistry';

describe('getMdxSpecsForSurface', () => {
  it('includes wiki-eligible components (surfaces unset or including "wiki") for "wiki"', () => {
    const wiki = getMdxSpecsForSurface('wiki');
    expect(wiki['EntityViewEmbed']).toBeDefined();
    expect(wiki['EntityChart']).toBeDefined();
    expect(wiki['EntityMetric']).toBeDefined();
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

  it('includes only components that explicitly opt in via surfaces for "dashboard"', () => {
    const dashboard = getMdxSpecsForSurface('dashboard');
    expect(dashboard['entity-lifecycle-chart']).toBeDefined();
    expect(dashboard['entity-activity-trend-chart']).toBeDefined();
    expect(dashboard['entity-stale-report']).toBeDefined();
    expect(dashboard['EntityViewEmbed']).toBeDefined();
    expect(dashboard['markdown']).toBeDefined();
  });

  it('excludes wiki-only components for "dashboard"', () => {
    const dashboard = getMdxSpecsForSurface('dashboard');
    expect(dashboard['Callout']).toBeUndefined();
  });

  it('never returns more entries than the full registry', () => {
    expect(Object.keys(getMdxSpecsForSurface('wiki')).length).toBeLessThanOrEqual(
      Object.keys(MDX_COMPONENTS).length
    );
    expect(Object.keys(getMdxSpecsForSurface('dashboard')).length).toBeLessThanOrEqual(
      Object.keys(MDX_COMPONENTS).length
    );
  });
});
