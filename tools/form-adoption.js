#!/usr/bin/env node

// Lists files in arch-register-packages/web/src that use raw form tags
// (<label>, <input>, <select>, <textarea>) without importing FormElement or
// FormGroup, grouped by area. Tracks the migration in issue #3737.
//
// Rules:
//  - Labeled fields use FormElement (packages/app-components); sections use FormGroup.
//  - Checkbox rows use FormCheckboxList.Row (web/src/components).
//  - Labeled* components are to become thin wrappers over FormElement.
//  - Toolbar/filter inline controls are out of scope.
//
// Usage: node tools/form-adoption.js

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = 'arch-register-packages/web/src';
const RAW = /<(label|input|select|textarea)[\s>]/g;
const ADOPTED = /\b(FormElement|FormGroup)\b/;

// Primitives that legitimately contain raw form tags
const PRIMITIVES = new Set([
  'components/LabeledSelect.tsx',
  'components/LabeledDateInput.tsx',
  'components/LabeledNumberInput.tsx',
  'components/LabeledValue.tsx',
  'components/FormGrid.tsx',
  'components/FormCheckboxList.tsx',
  'components/SearchInput.tsx'
]);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.(stories|test)\.tsx$/.test(name)) out.push(p);
  }
  return out;
};

const areaOf = rel => {
  const parts = rel.split('/');
  if (parts[0] === 'sections' && parts[1] === 'workspace-settings') return 'workspace-settings';
  if (parts[0] === 'sections' && parts[1] === 'entities') return 'sections/entities';
  return parts[0] === 'sections' ? `sections/${parts[1]}` : parts[0];
};

const byArea = new Map();
let adopted = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  const hits = (src.match(RAW) ?? []).length;
  if (ADOPTED.test(src)) adopted++;
  if (hits === 0 || ADOPTED.test(src) || PRIMITIVES.has(rel)) continue;
  const area = areaOf(rel);
  if (!byArea.has(area)) byArea.set(area, []);
  byArea.get(area).push({ rel, hits });
}

let total = 0;
for (const [area, files] of [...byArea].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${area} (${files.length})`);
  for (const f of files.sort((a, b) => b.hits - a.hits)) console.log(`  ${f.hits}\t${f.rel}`);
  total += files.length;
}
console.log(`\nUnmigrated: ${total} files; files using FormElement/FormGroup: ${adopted}`);
