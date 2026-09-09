import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useEntityBrowserTreeDataMock = vi.hoisted(() => vi.fn());

vi.mock('./useEntityBrowserTreeData', () => ({
  useEntityBrowserTreeData: useEntityBrowserTreeDataMock
}));

const { TreeView } = await import('./TreeView');

const baseProps = {
  workspaceId: 'workspace',
  projectScope: 'all' as const,
  q: '',
  typeFilter: null,
  ownerFilter: null,
  statusFilter: null,
  schemaMap: new Map(),
  onEntityClick: vi.fn(),
  onDelete: vi.fn(),
  onClone: vi.fn(),
  lifecycleStates: [],
  config: null,
  displayFields: []
};

const queryResult = (overrides: Record<string, unknown> = {}) => ({
  treeNodes: [],
  treeEdges: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides
});

describe('TreeView query states', () => {
  beforeEach(() => {
    useEntityBrowserTreeDataMock.mockReset();
  });

  it('does not present a loading query as an empty result', () => {
    useEntityBrowserTreeDataMock.mockReturnValue(queryResult({ isLoading: true }));

    const markup = renderToStaticMarkup(<TreeView {...baseProps} />);

    expect(markup).toContain('Loading tree');
    expect(markup).not.toContain('No entities found');
  });

  it('presents a failed query separately from an empty result', () => {
    useEntityBrowserTreeDataMock.mockReturnValue(queryResult({ isError: true }));

    const markup = renderToStaticMarkup(<TreeView {...baseProps} />);

    expect(markup).toContain('Tree data could not be loaded');
    expect(markup).not.toContain('No entities found');
  });

  it('keeps the successful empty state for an empty result', () => {
    useEntityBrowserTreeDataMock.mockReturnValue(queryResult());

    const markup = renderToStaticMarkup(<TreeView {...baseProps} />);

    expect(markup).toContain('No entities found');
  });
});
