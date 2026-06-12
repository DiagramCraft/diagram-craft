import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  navigateFromRailItem,
  resolveWorkspaceShellDescriptor,
  type WorkspaceShellContext
} from './workspaceShellDescriptors';
import { setWorkspaceShellEntries } from '../routes/workspaceShellRegistry';

const createContext = (
  routeId: string,
  params: Record<string, string> = {}
): WorkspaceShellContext => ({
  matches: [{ routeId, params }],
  navigate: vi.fn(),
  workspace: null,
  workspaceSlug: 'ws-1',
  schemas: [],
  enums: [],
  projects: [
    {
      id: 'p-1',
      name: 'Project One',
      status: 'active'
    } as WorkspaceShellContext['projects'][number]
  ],
  lifecycleStates: [],
  teams: [],
  availableSettingsSections: ['general']
});

beforeEach(() => {
  setWorkspaceShellEntries([
    {
      route: {},
      matchesRouteId: routeId =>
        routeId.includes('/entities/$entityId') && !routeId.includes('/diagrams/$diagramId'),
      buildShell: () => ({
        variant: 'detail',
        activeRailItem: 'entities',
        breadcrumbs: [
          { label: 'Home', onClick: vi.fn() },
          { label: 'Entities', onClick: vi.fn() },
          { label: 'Detail', onClick: vi.fn() }
        ],
        navigationLabel: 'Entities',
        renderNavigation: () => null
      })
    },
    {
      route: {},
      matchesRouteId: routeId => routeId.endsWith('/search'),
      buildShell: () => ({
        variant: 'full-bleed',
        activeRailItem: 'search',
        breadcrumbs: []
      })
    },
    {
      route: {},
      matchesRouteId: routeId => routeId.includes('/projects/$projectId/diagrams/$diagramId'),
      buildShell: () => ({
        variant: 'overlay'
      })
    },
    {
      route: {},
      matchesRouteId: routeId =>
        routeId.includes('/projects/$projectId') && !routeId.includes('/diagrams/$diagramId'),
      buildShell: () => ({
        variant: 'standard',
        activeRailItem: 'projects',
        breadcrumbs: []
      })
    }
  ]);
});

describe('resolveWorkspaceShellDescriptor', () => {
  it('resolves a detail shell for entity detail routes', () => {
    const descriptor = resolveWorkspaceShellDescriptor(
      createContext('/authenticated/$workspaceSlug/entities/$entityId', { entityId: 'e-1' })
    );

    expect(descriptor.variant).toBe('detail');
    if (descriptor.variant === 'overlay') throw new Error('expected non-overlay descriptor');
    expect(descriptor.activeRailItem).toBe('entities');
    expect(descriptor.breadcrumbs.map(item => item.label)).toEqual(['Home', 'Entities', 'Detail']);
  });

  it('resolves a full-bleed shell for search routes', () => {
    const descriptor = resolveWorkspaceShellDescriptor(
      createContext('/authenticated/$workspaceSlug/search')
    );

    expect(descriptor.variant).toBe('full-bleed');
    if (descriptor.variant === 'overlay') throw new Error('expected non-overlay descriptor');
    expect(descriptor.activeRailItem).toBe('search');
  });

  it('prefers the deepest mapped route when multiple matches are present', () => {
    const descriptor = resolveWorkspaceShellDescriptor({
      ...createContext('/authenticated/$workspaceSlug/projects/$projectId', { projectId: 'p-1' }),
      matches: [
        {
          routeId: '/authenticated/$workspaceSlug/projects/$projectId',
          params: { projectId: 'p-1' }
        },
        {
          routeId: '/authenticated/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
          params: { projectId: 'p-1', diagramId: 'd-1' }
        }
      ]
    });

    expect(descriptor.variant).toBe('overlay');
  });
});

describe('navigateFromRailItem', () => {
  it('opens the project dialog sentinel when there is no default project', () => {
    const navigate = vi.fn();

    const result = navigateFromRailItem('projects', {
      navigate,
      workspaceSlug: 'ws-1',
      projects: []
    });

    expect(result).toBe('open-project-dialog');
    expect(navigate).not.toHaveBeenCalled();
  });
});
