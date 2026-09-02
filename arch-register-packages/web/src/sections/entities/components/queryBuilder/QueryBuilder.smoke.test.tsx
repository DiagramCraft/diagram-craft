// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ProjectionColumns,
  ProjectionColumnsOnFilterLeaf,
  RelationForwardTraversal,
  TraversalWithScopedFilter
} from './QueryBuilder.stories';

// Render smoke tests over representative stories - exercises QueryBuilder -> QueryTree -> QueryLeaf
// -> ProjectionRow / ProjectionEditor wiring with realistic mock catalogs (#3162).
describe('QueryBuilder render smoke', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (element: React.ReactElement) => act(() => root.render(element));

  it('renders a query with standalone projection columns', () => {
    render(<ProjectionColumns />);
    expect(container.textContent).toContain('Columns');
    expect(container.textContent).toContain('Add column');
  });

  it('renders a column inline under its scoped filter leaf and offers "+ column"', () => {
    render(<ProjectionColumnsOnFilterLeaf />);
    expect(container.textContent).toContain('TR EOL');
    expect(container.textContent).toContain('Tech category');
    // The per-leaf add-column affordance.
    expect(container.querySelectorAll('button')).not.toHaveLength(0);
    expect(container.textContent).toMatch(/column/i);
  });

  it('renders a scoped-filter traversal leaf with the "+ column" affordance', () => {
    render(<TraversalWithScopedFilter />);
    expect(container.textContent).toContain('column');
  });

  it('renders a relation-rooted query with a relationForward projection', () => {
    render(<RelationForwardTraversal />);
    expect(container.textContent).not.toBe('');
  });
});
