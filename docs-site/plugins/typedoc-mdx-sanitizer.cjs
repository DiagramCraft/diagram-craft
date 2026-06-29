const fs = require('node:fs');
const path = require('node:path');

const sanitizeMarkdownContent = (content) => {
  const segments = content.split(/(\r?\n)/);
  let inFence = false;
  let fenceMarker = null;

  return segments
    .map((segment) => {
      if (segment === '\n' || segment === '\r\n') {
        return segment;
      }

      const fenceMatch = segment.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[2][0];

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

const walk = (dir, visit) => {
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

/** @param {{siteDir: string}} context */
module.exports = async function typedocMdxSanitizer(context) {
  const apiDocsDir = path.join(context.siteDir, 'docs', 'diagram-craft', 'api');

  return {
    name: 'typedoc-mdx-sanitizer',
    loadContent: async () => {
      walk(apiDocsDir, (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const sanitized = sanitizeMarkdownContent(content);

        if (sanitized !== content) {
          fs.writeFileSync(filePath, sanitized);
        }
      });
    }
  };
};
