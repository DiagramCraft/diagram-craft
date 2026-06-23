import { MarkdownEngine, parseMarkdown } from '@diagram-craft/markdown';

type MarkdownAst = ReturnType<typeof parseMarkdown>;

const markdownEngine = new MarkdownEngine();

const flattenNodeText = (nodes: MarkdownAst[number]['children']): string => {
  if (!nodes) return '';

  return nodes
    .map(node => {
      if (node.type === 'literal') return node.value;
      return flattenNodeText(node.children);
    })
    .join('');
};

export const extractFirstHeadingTitle = (markdown: string): string | null => {
  const ast = parseMarkdown(markdown);
  const heading = ast.find(node => node.type === 'heading' && node.level === 1);
  if (!heading) return null;

  const title = flattenNodeText(heading.children).trim();
  return title.length > 0 ? title : null;
};

export const renderMarkdownWithoutFirstHeading = (markdown: string): string => {
  const ast = parseMarkdown(markdown);
  const headingIndex = ast.findIndex(node => node.type === 'heading' && node.level === 1);

  if (headingIndex === -1) {
    return markdownEngine.toHTML(ast);
  }

  const astWithoutHeading = ast.filter((_, index) => index !== headingIndex);
  return markdownEngine.toHTML(astWithoutHeading);
};
