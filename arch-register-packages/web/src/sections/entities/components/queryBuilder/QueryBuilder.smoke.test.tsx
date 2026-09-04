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

  it('renders hop-attached projection columns (no standalone add-column section)', () => {
    render(<ProjectionColumns />);
    expect(container.textContent).toContain('System tier');
    expect(container.textContent).not.toContain('Add column');
    expect(container.textContent).not.toContain('Other columns');
  });

  it('renders columns inside their hop panel and adds one via "+ column"', () => {
    render(<ProjectionColumnsOnFilterLeaf />);
    expect(container.textContent).toContain('TR EOL');
    expect(container.textContent).toContain('Tech category');
    // The hop [...] panel labels its two sections.
    expect(container.textContent).toContain('Filter');
    expect(container.textContent).toContain('Columns');

    const aliasInputs = () =>
      container.querySelectorAll('input[placeholder="column name (optional)"]').length;
    const addColumn = [...container.querySelectorAll('button')].find(
      b => b.textContent?.trim() === 'column'
    );
    expect(addColumn).toBeDefined();
    const before = aliasInputs();
    act(() => addColumn!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    // A fresh column row adds its alias input.
    expect(aliasInputs()).toBe(before + 1);
  });

  it('renders a scoped-filter traversal leaf with the "+ column" affordance', () => {
    render(<TraversalWithScopedFilter />);
    const addColumn = [...container.querySelectorAll('button')].find(
      b => b.textContent?.trim() === 'column'
    );
    expect(addColumn).toBeDefined();
  });

  it('renders a relation-rooted query with a relationForward projection', () => {
    render(<RelationForwardTraversal />);
    expect(container.textContent).not.toBe('');
  });
});
