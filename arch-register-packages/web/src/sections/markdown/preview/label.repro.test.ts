import { describe, expect, it } from 'vitest';
import { parseMarkdownWithComponents } from './mdxMarkdown';

describe('Label preview color prop', () => {
  it('keeps the oklch color prop through preview parsing', () => {
    const ast = parseMarkdownWithComponents('<Label text="Draft" color="oklch(0.62 0.13 145)" />');
    const paragraph = ast.find(n => n.type === 'paragraph') as any;
    const componentNode = paragraph?.children?.find((n: any) => n.type === 'component');
    expect(componentNode?.props?.color).toBe('oklch(0.62 0.13 145)');
  });
});
