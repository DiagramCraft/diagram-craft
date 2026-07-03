import { describe, expect, it, vi } from 'vitest';
import { unnestBlock, wrapBlock } from './EditorBlock';

// The real mdxRegistry.tsx transitively imports packages/main's MultiWindowDetector,
// which crashes on localStorage in the vitest/Node environment (a pre-existing,
// unrelated issue) — mock a representative slice covering block/inline/wrapper modes
// instead of importing the full registry, mirroring preview/mdxMarkdown.test.ts.
vi.mock('../mdx-components/mdxRegistry', () => ({
  MDX_COMPONENTS: {
    Caption: { mode: 'block', acceptsChildren: true },
    ImageEmbed: { mode: 'block' },
    DiagramEmbed: { mode: 'block' },
    EntityField: { mode: 'inline' }
  }
}));

const { MDX_COMPONENTS } = await import('../mdx-components/mdxRegistry');

const makeFakeEditor = (children: unknown[]) => ({
  children,
  tf: {
    removeNodes: vi.fn(),
    insertNodes: vi.fn()
  }
});

describe('unnestBlock', () => {
  it('removes the wrapper and promotes its single child in its place', () => {
    const child = { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] };
    const wrapper = { type: 'Caption', caption: 'x', children: [child] };
    const editor = makeFakeEditor([wrapper]);

    unnestBlock(editor, 0);

    expect(editor.tf.removeNodes).toHaveBeenCalledWith({ at: [0] });
    expect(editor.tf.insertNodes).toHaveBeenCalledWith(child, { at: [0] });
  });

  it('is a no-op when the wrapper has no children', () => {
    const wrapper = { type: 'Caption', caption: 'x', children: [] };
    const editor = makeFakeEditor([wrapper]);

    unnestBlock(editor, 0);

    expect(editor.tf.removeNodes).not.toHaveBeenCalled();
    expect(editor.tf.insertNodes).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no node at the given index', () => {
    const editor = makeFakeEditor([]);

    unnestBlock(editor, 0);

    expect(editor.tf.removeNodes).not.toHaveBeenCalled();
    expect(editor.tf.insertNodes).not.toHaveBeenCalled();
  });
});

describe('wrapBlock', () => {
  it('removes the node and inserts the wrapper produced by createWrapper in its place', () => {
    const node = { type: 'DiagramEmbed', fileId: 'd1', children: [{ text: '' }] };
    const editor = makeFakeEditor([node]);
    const createWrapper = vi.fn(child => ({
      type: 'Caption',
      caption: '',
      align: '',
      numbered: false,
      children: [child]
    }));

    wrapBlock(editor, 0, createWrapper);

    expect(editor.tf.removeNodes).toHaveBeenCalledWith({ at: [0] });
    expect(createWrapper).toHaveBeenCalledWith(node);
    expect(editor.tf.insertNodes).toHaveBeenCalledWith(
      { type: 'Caption', caption: '', align: '', numbered: false, children: [node] },
      { at: [0] }
    );
  });

  it('is a no-op when there is no node at the given index', () => {
    const editor = makeFakeEditor([]);
    const createWrapper = vi.fn();

    wrapBlock(editor, 0, createWrapper);

    expect(createWrapper).not.toHaveBeenCalled();
    expect(editor.tf.removeNodes).not.toHaveBeenCalled();
    expect(editor.tf.insertNodes).not.toHaveBeenCalled();
  });
});

describe('wrapper/non-wrapper classification', () => {
  const registry = MDX_COMPONENTS as Record<
    string,
    { mode: 'block' | 'inline'; acceptsChildren?: boolean }
  >;

  it('Caption is the only wrapper (acceptsChildren: true)', () => {
    const wrapperTypes = Object.entries(registry)
      .filter(([, spec]) => spec.acceptsChildren)
      .map(([type]) => type);
    expect(wrapperTypes).toEqual(['Caption']);
  });

  it('block-mode, non-wrapper components (e.g. ImageEmbed, DiagramEmbed) qualify as wrappable targets', () => {
    expect(registry['ImageEmbed']?.mode).toBe('block');
    expect(registry['ImageEmbed']?.acceptsChildren).toBeUndefined();
    expect(registry['DiagramEmbed']?.mode).toBe('block');
    expect(registry['DiagramEmbed']?.acceptsChildren).toBeUndefined();
  });

  it('inline-mode components (e.g. EntityField) are neither wrappers nor wrappable top-level blocks', () => {
    expect(registry['EntityField']?.mode).toBe('inline');
    expect(registry['EntityField']?.acceptsChildren).toBeUndefined();
  });
});
