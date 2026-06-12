import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  navigateFromRailItem,
  resolveWorkspaceShellDescriptor,
  type WorkspaceShellContext
} from './workspaceShellDescriptors';

const createContext = (
  routeId: string,
  params: Record<string, string> = {},
  buildShell?: WorkspaceShellContext['matches'][number]['buildShell']
): WorkspaceShellContext => ({
  matches: [{ routeId, params, buildShell }],
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

const detailShell = () => ({
  variant: 'detail' as const,
  activeRailItem: 'entities' as const,
  breadcrumbs: [
    { label: 'Home', onClick: vi.fn() },
    { label: 'Entities', onClick: vi.fn() },
    { label: 'Detail', onClick: vi.fn() }
  ],
  navigationLabel: 'Entities',
  renderNavigation: () => null
});

const searchShell = () => ({
  variant: 'full-bleed' as const,
  activeRailItem: 'search' as const,
  breadcrumbs: []
});

const overlayShell = () => ({
  variant: 'overlay' as const
});

const projectShell = () => ({
  variant: 'standard' as const,
  activeRailItem: 'projects' as const,
  breadcrumbs: []
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveWorkspaceShellDescriptor', () => {
  it('resolves a detail shell for entity detail routes', () => {
    const descriptor = resolveWorkspaceShellDescriptor(
      createContext(
        '/authenticated/$workspaceSlug/entities/$entityId',
        { entityId: 'e-1' },
        detailShell
      )
    );

    expect(descriptor.variant).toBe('detail');
    if (descriptor.variant === 'overlay') throw new Error('expected non-overlay descriptor');
    expect(descriptor.activeRailItem).toBe('entities');
    expect(descriptor.breadcrumbs.map(item => item.label)).toEqual(['Home', 'Entities', 'Detail']);
  });

  it('resolves a full-bleed shell for search routes', () => {
    const descriptor = resolveWorkspaceShellDescriptor(
      createContext('/authenticated/$workspaceSlug/search', {}, searchShell)
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
          params: { projectId: 'p-1' },
          buildShell: projectShell
        },
        {
          routeId: '/authenticated/$workspaceSlug/projects/$projectId/diagrams/$diagramId',
          params: { projectId: 'p-1', diagramId: 'd-1' },
          buildShell: overlayShell
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
