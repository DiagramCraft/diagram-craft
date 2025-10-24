/**
 * Dependency analyzer for the diagram-craft monorepo.
 * Uses skott to analyze internal package dependencies and outputs hierarchical trees.
 *
 * Usage: node tools/dependencies.js [packages/module-name/src]
 * Example: node tools/dependencies.js packages/model/src
 */
import skott from 'skott';
import process from 'process';

/**
 * Recursively prints a submodule and its dependencies in a tree structure.
 * Dependencies within the same root module are prefixed with @, external dependencies are plain.
 *
 * @param {string} submodulePath - Full path to the submodule being printed
 * @param {string} rootModuleName - Name of the root module for internal dependency marking
 * @param {Object} groupedGraph - Skott's grouped dependency graph
 * @param {number} indentLevel - Current depth for indentation (0 = no indent)
 */
function printSubmodule(submodulePath, rootModuleName, groupedGraph, indentLevel) {
  const indent = '  '.repeat(indentLevel);

  console.log(`${indent}./${submodulePath.split('/').at(-1)}`);

  // Find and recursively print direct child submodules
  const childSubmodules = [
    ...new Set(
      Object.keys(groupedGraph).filter(
        entry =>
          entry.startsWith(`${submodulePath}/`) && entry.split('/').length === indentLevel + 2
      )
    )
  ].sort();
  for (const child of childSubmodules) {
    printSubmodule(child, rootModuleName, groupedGraph, indentLevel + 1);
  }

  // Print internal dependencies (prefixed with @)
  for (const dependency of groupedGraph[submodulePath].adjacentTo.sort()) {
    if (dependency.startsWith(`${submodulePath}/`)) continue;
    if (dependency.startsWith(`${rootModuleName}/`) || dependency === rootModuleName) {
      console.log(`${indent}  @${dependency}`);
    }
  }

  // Print external dependencies
  for (const dependency of groupedGraph[submodulePath].adjacentTo.sort()) {
    if (dependency.startsWith(`${submodulePath}/`) || dependency === rootModuleName) continue;
    if (!dependency.startsWith(`${rootModuleName}/`)) {
      console.log(`${indent}  ${dependency}`);
    }
  }
}

/**
 * Prints a top-level module with all its submodules and aggregated dependencies.
 *
 * @param {string} modulePath - Full path to the module
 * @param {string} rootModuleName - Base name of the root module
 * @param {Object} groupedGraph - Skott's grouped dependency graph
 */
function printModule(modulePath, rootModuleName, groupedGraph) {
  console.log(modulePath);

  // Collect all dependencies from the module and its children
  const allDependencies = new Set(groupedGraph[rootModuleName].adjacentTo);

  // Find direct child submodules (one level deep)
  const childSubmodules = [
    ...new Set(
      Object.keys(groupedGraph).filter(
        entry =>
          entry.startsWith(`${modulePath}/`) &&
          entry.split('/').length === modulePath.split('/').length + 1
      )
    )
  ].sort();

  // Print each submodule and collect its dependencies
  for (const child of childSubmodules) {
    if (groupedGraph[child].adjacentTo) {
      for (const dep of groupedGraph[child].adjacentTo) {
        allDependencies.add(dep);
      }
    }

    printSubmodule(child, rootModuleName.split('/').at(0), groupedGraph, 1);
  }

  // Print all external dependencies (not internal to this module)
  for (const dependency of [...allDependencies].sort()) {
    if (dependency === undefined) continue;
    if (dependency === rootModuleName) continue;
    if (dependency.startsWith(`${rootModuleName}/`)) continue;
    console.log(`  ${dependency}`);
  }
}

/**
 * Analyzes and prints dependencies for modules in the monorepo.
 * Uses skott to build a dependency graph and outputs hierarchical dependency trees.
 *
 * @param {string} [targetDirectory] - Optional directory to filter analysis (e.g., 'packages/model/src')
 */
async function analyzeDependencies(targetDirectory) {
  // Normalize the directory path to module name format
  let moduleFilter = targetDirectory?.replace('packages/', '').replace('/src', '');
  if (moduleFilter?.endsWith('/')) moduleFilter = moduleFilter.slice(0, -1);

  const api = await skott({
    circularMaxDepth: 10,
    cwd: process.cwd(),
    dependencyTracking: {
      builtin: false, // Ignore Node.js built-in modules
      thirdParty: false, // Ignore npm packages
      typeOnly: true // Track TypeScript type imports
    },
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    ignorePatterns: ['**/*.test.ts'],
    includeBaseDir: false,
    incremental: false,
    manifestPath: 'package.json',
    tsConfigPath: 'tsconfig.json',
    verbose: false,
    // Group files by their package/submodule path
    groupBy: filePath => {
      let moduleName = filePath
        .replace('packages/', '')
        .replace('/src', '')
        .split('/')
        .slice(0, -1) // Remove filename
        .join('/');

      if (moduleName?.endsWith('.js')) moduleName = 'other';

      return moduleName ?? 'other';
    }
  });

  const { getStructure } = api;
  const { groupedGraph } = getStructure();

  const moduleNames = Object.keys(groupedGraph).sort();
  for (const moduleName of moduleNames) {
    if (moduleName === 'other') continue;
    // Skip nested modules unless they match the filter
    if (moduleName.includes('/') && moduleName !== moduleFilter) continue;
    // If filter specified, only show modules that match
    if (moduleFilter && !moduleName.startsWith(moduleFilter)) continue;

    printModule(moduleName, moduleName.split('/').at(0), groupedGraph);
  }
}

// Run analysis with optional directory argument from command line
const targetDir = process.argv.length > 2 ? process.argv.at(-1) : undefined;
analyzeDependencies(targetDir);
