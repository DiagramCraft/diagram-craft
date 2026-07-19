import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'workspace-1' })
}));

vi.mock('../hooks/useDocuments', () => ({
  useDocumentList: () => ({ data: [], isLoading: false }),
  useDocumentPickerSearch: () => ({ data: [], isLoading: false })
}));

vi.mock('../hooks/useContentScope', () => ({
  useContentTree: () => ({ data: undefined })
}));

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({ open }: { open: boolean }) => (open ? <div>dialog</div> : null)
}));

const { DocumentPicker } = await import('./DocumentPicker');

describe('DocumentPicker', () => {
  it('renders the selected document and browse affordance from props', () => {
    const markup = renderToStaticMarkup(
      <DocumentPicker
        selectedDocumentId="doc-1"
        selectedDocument={{ name: 'Architecture notes' }}
        treeScopes={[{ scope: { kind: 'workspace', workspaceId: 'workspace-1' } }]}
        onSelectDocument={vi.fn()}
        onClearDocument={vi.fn()}
      />
    );

    expect(markup).toContain('Architecture notes');
    expect(markup).toContain('Browse');
  });

  it('does not render Browse without a configured tree scope', () => {
    const markup = renderToStaticMarkup(
      <DocumentPicker selectedDocumentId="" onSelectDocument={vi.fn()} onClearDocument={vi.fn()} />
    );

    expect(markup).not.toContain('Browse');
  });
});
