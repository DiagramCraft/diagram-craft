import { parseMarkdown } from '@diagram-craft/markdown';
import { markdownEngine, flattenNodeText, removeFirstH1 } from './markdownAstUtils';

export const extractFirstHeadingTitle = (markdown: string): string | null => {
  const ast = parseMarkdown(markdown);
  const heading = ast.find(node => node.type === 'heading' && node.level === 1);
  if (!heading) return null;
  const title = flattenNodeText(heading.children).trim();
  return title.length > 0 ? title : null;
};

export const renderMarkdownWithoutFirstHeading = (markdown: string): string =>
  markdownEngine.toHTML(removeFirstH1(parseMarkdown(markdown)));
