import skott from 'skott';
import process from 'process';

function printSubmodule(submodule, module, groupedGraph, depth) {
  let indent = '';
  for (let i = 0; i < depth; i++) indent += '  ';

  console.log(`${indent}/${submodule.split('/').at(-1)}`);

  const children = [
    ...new Set(
      groupedGraph[submodule].adjacentTo.filter(
        e => e.startsWith(`${submodule}/`) && e.split('/').length === depth + 2
      )
    )
  ].sort();
  for (const c of children) {
    printSubmodule(c, module, groupedGraph, depth + 1);
  }

  for (const a of groupedGraph[submodule].adjacentTo.sort()) {
    if (a.startsWith(`${submodule}/`)) continue;
    if (a.startsWith(`${module}/`) || a === module) {
      console.log(`${indent}  @${a}`);
    }
  }
  for (const a of groupedGraph[submodule].adjacentTo.sort()) {
    if (a.startsWith(`${submodule}/`) || a === module) continue;
    if (!a.startsWith(`${module}/`)) {
      console.log(`${indent}  ${a}`);
    }
  }
}

function printModule(c, m, groupedGraph) {
  console.log(c);

  const allDependencies = new Set(groupedGraph[m].adjacentTo);

  const children = [
    ...new Set(
      groupedGraph[c].adjacentTo.filter(
        e => e.startsWith(`${c}/`) && e.split('/').length === c.split('/').length + 1
      )
    )
  ].sort();

  for (const a of children) {
    if (groupedGraph[a].adjacentTo) allDependencies.add(...groupedGraph[a].adjacentTo);

    printSubmodule(a, m.split('/').at(0), groupedGraph, 1);
  }

  for (const a of [...allDependencies].sort()) {
    if (a === undefined) continue;
    if (a === m) continue;
    if (a.startsWith(`${m}/`)) continue;
    console.log(`  ${a}`);
  }
}

async function printDependencies(directory) {
  const startAt = directory.replace('packages/', '').replace('/src', '');

  const api = await skott({
    circularMaxDepth: 10,
    cwd: process.cwd(),
    dependencyTracking: {
      builtin: false,
      thirdParty: false,
      typeOnly: true
    },
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    ignorePatterns: ['**/*.test.ts'],
    includeBaseDir: false,
    incremental: false,
    manifestPath: 'package.json',
    tsConfigPath: 'tsconfig.json',
    verbose: false,
    groupBy: modulePath => {
      let group = modulePath
        .replace('packages/', '')
        .replace('/src', '')
        .split('/')
        .slice(0, -1)
        .join('/');

      if (group?.endsWith('.js')) group = 'other';

      return group ?? 'other';
    }
  });

  const { getStructure } = api;
  const { groupedGraph } = getStructure();

  const modules = Object.keys(groupedGraph).sort();
  for (const m of modules) {
    if (m === 'other') continue;
    if (m.includes('/') && m !== startAt) continue;
    if (startAt && !m.startsWith(startAt)) continue;

    printModule(m, m.split('/').at(0), groupedGraph);
  }
}

printDependencies(process.argv.length > 2 ? process.argv.at(-1) : undefined);
