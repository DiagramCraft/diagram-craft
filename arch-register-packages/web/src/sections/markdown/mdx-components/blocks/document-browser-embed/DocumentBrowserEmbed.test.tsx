import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@arch-register/api-types/projectContract';
import type { DocumentListItem } from '@arch-register/api-types/projectContract';
import type { WorkspaceContextType } from '../../../../../layouts/WorkspaceContext';
import { WorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { MdxContext } from '../../../MdxContext';
import { encodeDocumentBrowserEmbedConfig } from './DocumentBrowserEmbedCodec';
import { DocumentBrowserEmbed, resolveDocumentBrowserScope } from './DocumentBrowserEmbed';

const useDocumentListMock = vi.fn();

vi.mock('../../../../../hooks/useDocuments', () => ({
  useDocumentList: (...args: unknown[]) => useDocumentListMock(...args),
  useDocumentTypes: () => ({ data: [] })
}));

vi.mock('../../../../../hooks/useEntities', () => ({
  useEntity: () => ({ data: undefined })
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

const project = {
  id: 'project-internal',
  public_id: 'PROJECT-1',
  name: 'Project One'
} as Project;

const workspaceContext = {
  workspace: null,
  workspaceSlug: 'demo',
  schemas: [],
  enums: [],
  projects: [project],
  lifecycleStates: [],
  teams: [],
  projectEntityTypes: [],
  permissions: {
    canManageWorkspaces: false,
    canViewSchemas: false,
    canEditSchemas: false,
    canManageTeams: false,
    canViewAudit: false,
    canCreateProjects: false,
    canCreateEntities: false,
    canManageMembers: false,
    canManageJobs: false,
    canManageViews: false,
    canManageAdminViews: false
  },
  availableSettingsSections: [],
  defaultSettingsSection: null,
  openAddProjectDialog: vi.fn(),
  openAddEntityDialog: vi.fn()
} satisfies WorkspaceContextType;

const documentItem: DocumentListItem = {
  file: {
    id: 'doc-1',
    project_id: 'project-internal',
    entity_id: null,
    project_public_id: 'PROJECT-1',
    path: 'docs/architecture.md',
    name: 'Architecture',
    role: null,
    size_bytes: 10,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
    type: 'markdown',
    content_metadata: null,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  scope: 'project',
  document_type_id: null,
  document_type_name: null,
  document_type_color: null,
  document_type_icon: null,
  metadata: {}
};

describe('DocumentBrowserEmbed', () => {
  it('derives the fixed containing scope', () => {
    expect(resolveDocumentBrowserScope()).toEqual({ scope: 'workspace' });
    expect(resolveDocumentBrowserScope('PROJECT-1')).toEqual({
      scope: 'project',
      projectId: 'PROJECT-1'
    });
    expect(resolveDocumentBrowserScope(undefined, 'ENTITY-1')).toEqual({
      scope: 'entity',
      entityId: 'ENTITY-1'
    });
  });

  it('queries and renders documents for the containing project', () => {
    useDocumentListMock.mockReturnValue({ data: [documentItem], isLoading: false, isError: false });
    const config = encodeDocumentBrowserEmbedConfig({
      q: 'arch',
      conditions: [],
      sort: 'updated_at',
      sortDir: 'desc',
      visibleBaseColumnIds: ['document_type', 'location', 'updated_at'],
      visibleFieldIds: []
    });

    const markup = renderToStaticMarkup(
      <WorkspaceContext.Provider value={workspaceContext}>
        <MdxContext.Provider value={{ workspaceSlug: 'demo', projectId: 'PROJECT-1' }}>
          <DocumentBrowserEmbed config={config} />
        </MdxContext.Provider>
      </WorkspaceContext.Provider>
    );

    expect(useDocumentListMock).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({
        q: 'arch',
        scope: 'project',
        projectId: 'PROJECT-1',
        limit: 100
      }),
      { enabled: true }
    );
    expect(markup).toContain('Architecture');
    expect(markup).toContain('Project One');
  });

  it('respects visibility settings for fixed table columns', () => {
    useDocumentListMock.mockReturnValue({ data: [documentItem], isLoading: false, isError: false });
    const config = encodeDocumentBrowserEmbedConfig({
      q: '',
      conditions: [],
      sort: 'updated_at',
      sortDir: 'desc',
      visibleBaseColumnIds: ['document_type'],
      visibleFieldIds: []
    });

    const markup = renderToStaticMarkup(
      <WorkspaceContext.Provider value={workspaceContext}>
        <MdxContext.Provider value={{ workspaceSlug: 'demo' }}>
          <DocumentBrowserEmbed config={config} />
        </MdxContext.Provider>
      </WorkspaceContext.Provider>
    );

    expect(markup).toContain('Document type');
    expect(markup).not.toContain('Location');
    expect(markup).not.toContain('Updated');
  });
});
