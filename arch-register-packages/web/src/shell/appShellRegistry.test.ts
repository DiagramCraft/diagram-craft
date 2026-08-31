import { describe, expect, it } from 'vitest';
import {
  APP_DEFINITIONS,
  APP_RAIL_ROUTES,
  appAccentStyle,
  getAppDefinition,
  railItemToAppId
} from './appShellRegistry';
import { GLOSSARY_RAIL_ITEM_ID, GLOSSARY_RAIL_PATH } from '../app/business-glossary/glossaryShell';

describe('appShellRegistry', () => {
  it('always includes an always-on Home app that owns the core rail items', () => {
    const home = getAppDefinition('home');
    expect(home.id).toBe('home');
    expect(home.enablement).toBe('always');
    expect(home.railItems).toContain('entities');
    expect(home.railItems).not.toContain(GLOSSARY_RAIL_ITEM_ID);
    expect(home.tint).toBeUndefined();
  });

  it('registers Business Glossary as a capability-gated app that owns only the glossary rail item', () => {
    const glossary = getAppDefinition(GLOSSARY_RAIL_ITEM_ID);
    expect(glossary.railItems).toEqual([GLOSSARY_RAIL_ITEM_ID]);
    expect(glossary.enablement).toEqual({ capabilityType: 'business-glossary' });
    expect(glossary.rootRoute).toBe(GLOSSARY_RAIL_PATH);
  });

  it('maps rail items back to their owning app and falls back to home', () => {
    expect(railItemToAppId('entities')).toBe('home');
    expect(railItemToAppId(GLOSSARY_RAIL_ITEM_ID)).toBe(GLOSSARY_RAIL_ITEM_ID);
    expect(railItemToAppId(null)).toBe('home');
  });

  it('exposes non-home app routes under the stable APP_RAIL_ROUTES shape', () => {
    expect(APP_RAIL_ROUTES).toEqual({ [GLOSSARY_RAIL_ITEM_ID]: GLOSSARY_RAIL_PATH });
  });

  it('produces accent overrides only for apps that define a tint', () => {
    expect(appAccentStyle(getAppDefinition('home'))).toEqual({});
    const glossaryStyle = appAccentStyle(getAppDefinition(GLOSSARY_RAIL_ITEM_ID));
    expect(glossaryStyle).toHaveProperty('--accent-chroma');
  });

  it('every rail item listed by an app has metadata coverage via unique ownership', () => {
    const owned = APP_DEFINITIONS.flatMap(app => app.railItems);
    expect(new Set(owned).size).toBe(owned.length);
  });
});
