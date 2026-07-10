import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const renderLeaf = (name: string) => (props: Record<string, unknown>) => (
  <div
    data-view={name}
    data-read-only={String(props.readOnly ?? false)}
    data-hide-toolbar={String(props.hideToolbar ?? false)}
    data-click={typeof props.onEntityClick}
    data-delete={typeof props.onDelete}
    data-clone={typeof props.onClone}
    data-config={typeof props.onConfigChange}
    data-selection={typeof props.onSelectRow}
  />
);

vi.mock('./BubbleView', () => ({ BubbleView: renderLeaf('bubble') }));
vi.mock('./CardsView', () => ({ CardsView: renderLeaf('cards') }));
vi.mock('./ExploreView', () => ({ ExploreView: renderLeaf('explore') }));
vi.mock('./HierarchyView', () => ({ HierarchyView: renderLeaf('hierarchy') }));
vi.mock('./MatrixView', () => ({ MatrixView: renderLeaf('matrix') }));
vi.mock('./RadarView', () => ({ RadarView: renderLeaf('radar') }));
vi.mock('./TableView', () => ({ TableView: renderLeaf('table') }));
vi.mock('./TimelineView', () => ({ TimelineView: renderLeaf('timeline') }));
vi.mock('./TreeView', () => ({ TreeView: renderLeaf('tree') }));

const { EntityBrowserView } = await import('./EntityBrowserView');

const onConfigChange = vi.fn();
const onEntityClick = vi.fn();
const onDelete = vi.fn();
const onClone = vi.fn();
const onSelectAll = vi.fn();
const onSelectRow = vi.fn();

const baseProps = {
  rows: [],
  schemaMap: new Map(),
  schemas: [],
  lifecycleStates: [],
  projects: [],
  workspaceId: 'workspace',
  projectScope: 'all' as const,
  q: '',
  typeFilter: null,
  ownerFilter: null,
  statusFilter: null,
  activeViewConfig: null,
  displayFields: []
};

const modes = [
  {
    name: 'interactive',
    mode: {
      kind: 'interactive' as const,
      onConfigChange,
      onEntityClick,
      onDelete,
      onClone,
      selectedIds: new Set<string>(),
      onSelectAll,
      onSelectRow
    },
    readOnly: false,
    hideToolbar: false,
    hasSelection: true
  },
  {
    name: 'configure',
    mode: { kind: 'configure' as const, onConfigChange },
    readOnly: true,
    hideToolbar: false,
    hasSelection: false
  },
  {
    name: 'published',
    mode: { kind: 'published' as const, onEntityClick },
    readOnly: true,
    hideToolbar: true,
    hasSelection: false
  },
  {
    name: 'snapshot',
    mode: { kind: 'snapshot' as const, onConfigChange, onEntityClick },
    readOnly: true,
    hideToolbar: false,
    hasSelection: false
  }
];

const views = [
  'table',
  'cards',
  'tree',
  'hierarchy',
  'explore',
  'matrix',
  'timeline',
  'radar',
  'bubble'
] as const;
const entityListViews = new Set(['table', 'cards', 'tree']);
const configurableViews = new Set([
  'hierarchy',
  'explore',
  'matrix',
  'timeline',
  'radar',
  'bubble'
]);

describe('EntityBrowserView', () => {
  it.each(
    modes.flatMap(mode => views.map(view => ({ ...mode, view })))
  )('dispatches $view with $name behavior', ({
    view,
    mode,
    readOnly,
    hideToolbar,
    hasSelection
  }) => {
    const markup = renderToStaticMarkup(
      <EntityBrowserView {...baseProps} view={view} mode={mode} />
    );

    expect(markup).toContain(`data-view="${view}"`);
    expect(markup).toContain(`data-read-only="${entityListViews.has(view) ? readOnly : false}"`);
    expect(markup).toContain(
      `data-hide-toolbar="${configurableViews.has(view) ? hideToolbar : false}"`
    );
    expect(markup).toContain('data-click="function"');
    expect(markup).toContain(
      `data-delete="${entityListViews.has(view) ? 'function' : 'undefined'}"`
    );
    expect(markup).toContain(
      `data-clone="${entityListViews.has(view) ? 'function' : 'undefined'}"`
    );
    expect(markup).toContain(
      `data-config="${configurableViews.has(view) ? 'function' : 'undefined'}"`
    );
    expect(markup).toContain(
      `data-selection="${view === 'table' && hasSelection ? 'function' : 'undefined'}"`
    );
  });
});
