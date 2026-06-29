import fs from 'node:fs';
import path from 'node:path';

const apiDocsDir = path.join(process.cwd(), 'docs', 'diagram-craft', 'api');

const sanitizeMarkdownContent = (content: string) => {
  const segments = content.split(/(\r?\n)/);
  let inFence = false;
  let fenceMarker: '`' | '~' | null = null;

  return segments
    .map((segment) => {
      if (segment === '\n' || segment === '\r\n') {
        return segment;
      }

      const fenceMatch = segment.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[2][0] as '`' | '~';

        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (fenceMarker === marker) {
          inFence = false;
          fenceMarker = null;
        }

        return segment;
      }

      if (inFence) {
        return segment;
      }

      return segment
        .split(/(`+[^`]*`+)/g)
        .map((part) => (part.startsWith('`') && part.endsWith('`') ? part : part.replace(/<=/g, '&lt;=')))
        .join('');
    })
    .join('');
};

const walk = (dir: string, visit: (filePath: string) => void) => {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, visit);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      visit(fullPath);
    }
  }
};

walk(apiDocsDir, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const sanitized = sanitizeMarkdownContent(content);

  if (sanitized !== content) {
    fs.writeFileSync(filePath, sanitized);
  }
});
