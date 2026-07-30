import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MdxContext } from '../../markdown/MdxContext';
import { WikiPageWidget, WikiPageWidgetTitle, isInDashboardScope } from './WikiPageWidget';

vi.mock('../../../hooks/useContentScope', () => ({
  useContentFile: () => ({
    data: { id: 'wiki-1', name: 'Architecture', type: 'markdown', project_id: null },
    isLoading: false,
    isError: false
  })
}));

vi.mock('../../../hooks/useMarkdownContent', () => ({
  useMarkdownContent: () => ({
    data: { body: '# Architecture\n\nThe platform overview.' },
    isLoading: false,
    isError: false
  })
}));

describe('WikiPageWidget', () => {
  it('renders the selected wiki page body and current page name', () => {
    const html = renderToStaticMarkup(
      <MdxContext.Provider
        value={{
          workspaceSlug: 'workspace',
          dashboardSurface: 'workspace',
          renderMode: 'dashboard'
        }}
      >
        <WikiPageWidget config={{ nodeId: 'wiki-1' }} />
        <WikiPageWidgetTitle config={{ nodeId: 'wiki-1' }} />
      </MdxContext.Provider>
    );

    expect(html).toContain('<h1>Architecture</h1>');
    expect(html).toContain('The platform overview.');
    expect(html).toContain('Architecture');
  });

  it('requires a project page to belong to the active project', () => {
    expect(isInDashboardScope('project-1', 'project', 'project-1')).toBe(true);
    expect(isInDashboardScope('project-1', 'project', 'project-2')).toBe(false);
    expect(isInDashboardScope(undefined, 'workspace', null)).toBe(true);
    expect(isInDashboardScope(undefined, 'workspace', 'project-1')).toBe(false);
  });
});
