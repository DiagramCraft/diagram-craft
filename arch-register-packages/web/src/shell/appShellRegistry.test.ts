import { describe, expect, it } from 'vitest';
import {
  APP_DEFINITIONS,
  APP_RAIL_ROUTES,
  appAccentStyle,
  getAppDefinition,
  getRailSection,
  RAIL_ROUTES,
  railItemMeta,
  railItemToAppId
} from './appShellRegistry';
import { GLOSSARY_RAIL_ITEM_ID, GLOSSARY_RAIL_PATH } from '../app/business-glossary/glossaryShell';
import {
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_HEATMAPS_ID,
  STRATEGY_TRACEABILITY_ID,
  STRATEGY_RAIL_PATHS
} from '../app/strategy-model/strategySections';

const railIds = (appId: Parameters<typeof getAppDefinition>[0]) =>
  getAppDefinition(appId).sections.map(section => section.id);

describe('appShellRegistry', () => {
  it('always includes an always-on Home app that owns the core rail sections', () => {
    const home = getAppDefinition('home');
    expect(home.id).toBe('home');
    expect(home.applicationId).toBe('home');
    expect(home.enablement).toBe('always');
    expect(railIds('home')).toContain('entities');
    expect(railIds('home')).not.toContain(GLOSSARY_RAIL_ITEM_ID);
    expect(home.tint).toBeUndefined();
  });

  it('registers Business Glossary as a capability-gated app that owns only the glossary rail section', () => {
    const glossary = getAppDefinition(GLOSSARY_RAIL_ITEM_ID);
    expect(glossary.applicationId).toBe('business-glossary');
    expect(railIds(GLOSSARY_RAIL_ITEM_ID)).toEqual([GLOSSARY_RAIL_ITEM_ID]);
    expect(glossary.enablement).toEqual({ capabilityType: 'business-glossary' });
    const [section] = glossary.sections;
    expect(section?.route).toBe(GLOSSARY_RAIL_PATH);
    expect(section?.icon).toBeTypeOf('function');
    expect(section?.tooltip).toBe('Business glossary');
  });

  it('maps rail items back to their owning app and falls back to home', () => {
    expect(railItemToAppId('entities')).toBe('home');
    expect(railItemToAppId(GLOSSARY_RAIL_ITEM_ID)).toBe(GLOSSARY_RAIL_ITEM_ID);
    expect(railItemToAppId(null)).toBe('home');
  });

  it('derives rail-item metadata from the owning app section', () => {
    expect(railItemMeta('entities').tooltip).toBe('Entities');
    expect(railItemMeta('assistant').separator).toBe(true);
    expect(railItemMeta(GLOSSARY_RAIL_ITEM_ID).tooltip).toBe('Business glossary');
    expect(getRailSection(GLOSSARY_RAIL_ITEM_ID)?.route).toBe(GLOSSARY_RAIL_PATH);
  });

  it('registers Strategy & Capability Modelling as a capability-gated app owning four rail sections', () => {
    const strategy = getAppDefinition(STRATEGY_CAPABILITY_MAP_ID);
    expect(strategy.applicationId).toBe('strategy-model');
    // Heatmaps (#3193) is deprioritized — its route is retained but it is not a rail section.
    expect(railIds(STRATEGY_CAPABILITY_MAP_ID)).toHaveLength(4);
    expect(railIds(STRATEGY_CAPABILITY_MAP_ID)).not.toContain(STRATEGY_HEATMAPS_ID);
    expect(strategy.enablement).toEqual({ capabilityType: 'strategy-model' });
    expect(getRailSection(STRATEGY_TRACEABILITY_ID)?.route).toBe(
      STRATEGY_RAIL_PATHS[STRATEGY_TRACEABILITY_ID]
    );
  });

  it('exposes non-home app routes under the stable APP_RAIL_ROUTES shape', () => {
    // Heatmaps is absent from the rail (see above), so its route is not in APP_RAIL_ROUTES.
    const shellStrategyRoutes = Object.fromEntries(
      Object.entries(STRATEGY_RAIL_PATHS).filter(([id]) => id !== STRATEGY_HEATMAPS_ID)
    );
    expect(APP_RAIL_ROUTES).toEqual({
      [GLOSSARY_RAIL_ITEM_ID]: GLOSSARY_RAIL_PATH,
      ...shellStrategyRoutes
    });
  });

  it('exposes every section route (home included) via RAIL_ROUTES', () => {
    expect(RAIL_ROUTES.entities).toBe('/$workspaceSlug/entities');
    expect(RAIL_ROUTES[GLOSSARY_RAIL_ITEM_ID]).toBe(GLOSSARY_RAIL_PATH);
    expect(RAIL_ROUTES[STRATEGY_CAPABILITY_MAP_ID]).toBe(
      STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID]
    );
    expect(RAIL_ROUTES.home).toBe('/$workspaceSlug');
  });

  it('produces accent overrides only for apps that define a tint', () => {
    expect(appAccentStyle(getAppDefinition('home'))).toEqual({});
    const glossaryStyle = appAccentStyle(getAppDefinition(GLOSSARY_RAIL_ITEM_ID));
    expect(glossaryStyle).toHaveProperty('--accent-chroma');
  });

  it('every rail section listed by an app is uniquely owned', () => {
    const owned = APP_DEFINITIONS.flatMap(app => app.sections.map(section => section.id));
    expect(new Set(owned).size).toBe(owned.length);
  });
});
