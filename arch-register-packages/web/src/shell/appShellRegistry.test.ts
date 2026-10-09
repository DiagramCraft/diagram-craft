import { describe, expect, it } from 'vitest';
import type { WorkspaceApplicationWithDashboards } from '@arch-register/api-types/applicationContract';
import {
  appAccentStyle,
  applicationShortCode,
  APP_ROUTE,
  buildAppDefinitions,
  getAppDefinition,
  getRailSection,
  railItemToAppId
} from './appShellRegistry';

const dashboard = (id: string, order: number, overrides = {}) => ({
  id,
  name: `Dashboard ${id}`,
  icon: null,
  railLabel: null,
  order,
  ...overrides
});

const application = (
  key: string,
  overrides: Partial<WorkspaceApplicationWithDashboards> = {}
): WorkspaceApplicationWithDashboards => ({
  id: `id-${key}`,
  workspaceId: 'ws',
  key,
  name: 'Risk & Compliance',
  description: 'desc',
  accentColor: 'oklch(0.6 0.16 25)',
  order: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: null,
  dashboards: [dashboard('d2', 1, { railLabel: 'Second', icon: 'TbApi' }), dashboard('d1', 0)],
  ...overrides
});

const apps = buildAppDefinitions([application('risk'), application('empty', { dashboards: [] })]);

describe('appShellRegistry', () => {
  it('always includes a Home app that owns the core rail sections', () => {
    const home = getAppDefinition(apps, 'home');
    expect(home.applicationId).toBe('home');
    expect(home.sections.map(section => section.id)).toContain('entities');
    expect(home.tint).toBeUndefined();
    expect(buildAppDefinitions(undefined).map(app => app.id)).toEqual(['home']);
  });

  it('builds one app per application with dashboards, sections in dashboard order', () => {
    expect(apps.map(app => app.id)).toEqual(['home', 'risk']);
    const risk = getAppDefinition(apps, 'risk');
    expect(risk.applicationId).toBe('risk');
    expect(risk.shortCode).toBe('RC');
    expect(risk.sections.map(section => section.id)).toEqual(['d1', 'd2']);
    expect(risk.sections[1]).toMatchObject({
      tooltip: 'Second',
      route: APP_ROUTE,
      routeParams: { appKey: 'risk', dashboardId: 'd2' }
    });
    expect(risk.sections[0]!.tooltip).toBe('Dashboard d1');
  });

  it('only provides a primary sidebar for dashboards that configure one', () => {
    const withSidebar = buildAppDefinitions([
      application('risk', {
        dashboards: [
          dashboard('d1', 0),
          dashboard('d2', 1, {
            sidebar: { kind: 'options', variableName: 'v', options: [{ value: 'a', label: 'A' }] }
          })
        ]
      })
    ]);
    const sections = getAppDefinition(withSidebar, 'risk').sections;
    expect(sections[0]!.primarySidebar).toBeUndefined();
    expect(sections[1]!.primarySidebar).toBeDefined();
  });

  it('maps rail items back to their owning app and falls back to home', () => {
    expect(railItemToAppId(apps, 'entities')).toBe('home');
    expect(railItemToAppId(apps, 'd2')).toBe('risk');
    expect(railItemToAppId(apps, null)).toBe('home');
    expect(railItemToAppId(apps, 'unknown')).toBe('home');
    expect(getRailSection(apps, 'd1')?.routeParams).toEqual({ appKey: 'risk', dashboardId: 'd1' });
  });

  it('produces accent overrides only for apps that define an accent color', () => {
    expect(appAccentStyle(getAppDefinition(apps, 'home'))).toEqual({});
    expect(appAccentStyle(getAppDefinition(apps, 'risk'))).toHaveProperty('--accent-chroma');
    const plain = buildAppDefinitions([application('x', { accentColor: null })]);
    expect(appAccentStyle(getAppDefinition(plain, 'x'))).toEqual({});
  });

  it('derives the switcher badge from the application name', () => {
    expect(applicationShortCode('Business Glossary')).toBe('BG');
    expect(applicationShortCode('Strategy & Capability Modelling')).toBe('SC');
    expect(applicationShortCode('Data')).toBe('D');
  });

  it('keeps every rail section uniquely owned', () => {
    const owned = apps.flatMap(app => app.sections.map(section => section.id));
    expect(new Set(owned).size).toBe(owned.length);
  });
});
