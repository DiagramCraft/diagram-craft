const fs = require('node:fs');
const path = require('node:path');

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
        const sanitized = content.replace(/<=/g, '&lt;=');

        if (sanitized !== content) {
          fs.writeFileSync(filePath, sanitized);
        }
      });
    }
  };
};
