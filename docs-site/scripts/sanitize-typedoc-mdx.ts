import fs from 'node:fs';
import path from 'node:path';

const apiDocsDir = path.join(process.cwd(), 'docs', 'diagram-craft', 'api');

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
  const sanitized = content.replace(/<=/g, '&lt;=');

  if (sanitized !== content) {
    fs.writeFileSync(filePath, sanitized);
  }
});
