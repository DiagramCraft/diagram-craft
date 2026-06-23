import { MarkdownEngine, parseMarkdown } from '@diagram-craft/markdown';

type ASTNode = ReturnType<typeof parseMarkdown>[number];

export const markdownEngine = new MarkdownEngine();

export const flattenNodeText = (nodes: ASTNode['children']): string => {
  if (!nodes) return '';
  return nodes.map(n => (n.type === 'literal' ? n.value : flattenNodeText(n.children))).join('');
};

export const removeFirstH1 = (nodes: ASTNode[]): ASTNode[] => {
  const idx = nodes.findIndex(n => n.type === 'heading' && n.level === 1);
  return idx >= 0 ? nodes.filter((_, i) => i !== idx) : nodes;
};
