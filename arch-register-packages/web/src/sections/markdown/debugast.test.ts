import { test } from 'vitest';
import { parseMarkdownWithComponents } from './preview/mdxMarkdown';

test('debug', () => {
  const nodes = parseMarkdownWithComponents('Before\n\n<div class="old">raw</div>\n\nAfter');
  console.log(JSON.stringify(nodes, null, 2));
});
