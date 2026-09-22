import { describe, expect, it } from 'vitest';
import {
  APP_DEFINITIONS,
  appAccentStyle,
  getAppDefinition,
  getRailSection,
  RAIL_ROUTES,
  railItemMeta,
  railItemToAppId
} from './appShellRegistry';
import { GLOSSARY_RAIL_ITEM_ID, GLOSSARY_RAIL_PATH } from '../app/business-glossary/glossaryShell';
import { STRATEGY_CAPABILITY_MAP_ID, STRATEGY_RAIL_PATHS } from '../app/strategy-model/strategySections';
import { VENDOR_OVERVIEW_ID, VENDOR_RAIL_PATHS } from '../app/vendor-management/vendorManagementSections';

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

  it('exposes every section route (home included) via RAIL_ROUTES', () => {
    expect(RAIL_ROUTES.entities).toBe('/$workspaceSlug/entities');
    expect(RAIL_ROUTES[GLOSSARY_RAIL_ITEM_ID]).toBe(GLOSSARY_RAIL_PATH);
    expect(RAIL_ROUTES[STRATEGY_CAPABILITY_MAP_ID]).toBe(
      STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID]
    );
    expect(RAIL_ROUTES[VENDOR_OVERVIEW_ID]).toBe(VENDOR_RAIL_PATHS[VENDOR_OVERVIEW_ID]);
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
