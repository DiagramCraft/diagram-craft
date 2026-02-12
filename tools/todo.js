#!/usr/bin/env node

// Shows TODO comments added, removed, and remaining in modified files
// compared to the main branch. Exits with status 1 if any TODOs were added.
//
// Usage: node tools/todo.js

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

// Formatting
const BOLD = '\x1b[1m';
const BOLD_GREEN = '\x1b[1;32m';
const NC = '\x1b[0m';

// Find main branch
function getMainBranch() {
  try {
    execSync('git rev-parse --verify main', { stdio: 'ignore' });
    return 'main';
  } catch {
    try {
      execSync('git rev-parse --verify master', { stdio: 'ignore' });
      return 'master';
    } catch {
      console.error('Error: Could not find main or master branch');
      process.exit(1);
    }
  }
}

// Get current branch
function getCurrentBranch() {
  return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
}

// Get git repo root
function getRepoRoot() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
}

// Get diff between branches
function getDiff(mainBranch, currentBranch) {
  try {
    return execSync(`git diff ${mainBranch}...${currentBranch} -U0`, { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

// Parse diff and extract TODOs and modified files
function parseDiff(diff) {
  const addedByFile = new Map();
  const removedByFile = new Map();
  const modifiedFiles = new Set();

  let currentFile = '';
  let currentAddLine = 0;

  for (const line of diff.split('\n')) {
    // Check for file header
    const fileMatch = line.match(/^diff --git a\/.*? b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      modifiedFiles.add(currentFile);
      continue;
    }

    // Check for hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentAddLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    // Check for added TODO
    if (line.startsWith('+') && !line.startsWith('+++') && line.includes('TODO')) {
      const todoText = line.slice(1).trim();
      if (currentFile) {
        if (!addedByFile.has(currentFile)) {
          addedByFile.set(currentFile, []);
        }
        addedByFile.get(currentFile).push({ text: todoText, line: currentAddLine });
      }
    }

    // Increment line number for added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentAddLine++;
    }

    // Check for removed TODO
    if (line.startsWith('-') && !line.startsWith('---') && line.includes('TODO')) {
      const todoText = line.slice(1).trim();
      if (currentFile) {
        if (!removedByFile.has(currentFile)) {
          removedByFile.set(currentFile, []);
        }
        removedByFile.get(currentFile).push(todoText);
      }
    }
  }

  return { addedByFile, removedByFile, modifiedFiles };
}

// Find all TODOs in a file
function findTodosInFile(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const todos = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('TODO')) {
        todos.push({ text: lines[i].trim(), line: i + 1 });
      }
    }

    return todos;
  } catch {
    return [];
  }
}

// Get remaining TODOs (all TODOs in modified files except the added ones)
function getRemainingTodos(modifiedFiles, addedByFile, repoRoot) {
  const remainingByFile = new Map();

  for (const file of modifiedFiles) {
    const absolutePath = `${repoRoot}/${file}`;
    const allTodos = findTodosInFile(absolutePath);
    const addedTodos = addedByFile.get(file) || [];

    // Create a set of added line numbers for quick lookup
    const addedLines = new Set(addedTodos.map(t => t.line));

    // Filter out TODOs that were added in this diff
    const remaining = allTodos.filter(todo => !addedLines.has(todo.line));

    if (remaining.length > 0) {
      remainingByFile.set(file, remaining);
    }
  }

  return remainingByFile;
}

// Display TODOs with links grouped by file
function displayTodosWithLinks(todosByFile, repoRoot, symbol) {
  if (todosByFile.size === 0) {
    return false;
  }

  const sortedFiles = [...todosByFile.keys()].sort();
  for (const file of sortedFiles) {
    console.log(`  ${file}`);
    for (const todo of todosByFile.get(file)) {
      const absolutePath = `${repoRoot}/${file}`;
      console.log(`    ${symbol} ${BOLD}${todo.text}${NC}`);
      console.log(`      file://${absolutePath}:${todo.line}`);
    }
  }
  return true;
}

// Display removed TODOs grouped by file
function displayRemovedTodos(todosByFile) {
  if (todosByFile.size === 0) {
    return false;
  }

  const sortedFiles = [...todosByFile.keys()].sort();
  for (const file of sortedFiles) {
    console.log(`  ${file}`);
    for (const todo of todosByFile.get(file)) {
      console.log(`    - ${BOLD}${todo}${NC}`);
    }
  }
  return true;
}

// Main
const mainBranch = getMainBranch();
const currentBranch = getCurrentBranch();
const repoRoot = getRepoRoot();

console.log(`Comparing TODOs: ${currentBranch} vs ${mainBranch}`);
console.log('');

const diff = getDiff(mainBranch, currentBranch);
const { addedByFile, removedByFile, modifiedFiles } = parseDiff(diff);
const remainingByFile = getRemainingTodos(modifiedFiles, addedByFile, repoRoot);

// Display added TODOs
console.log(`${BOLD_GREEN}=== ADDED TODOs ===${NC}`);
if (!displayTodosWithLinks(addedByFile, repoRoot, '+')) {
  console.log('  No new TODOs added');
}

console.log('');

// Display removed TODOs
console.log(`${BOLD_GREEN}=== REMOVED/RESOLVED TODOs ===${NC}`);
if (!displayRemovedTodos(removedByFile)) {
  console.log('  No TODOs removed');
}

console.log('');

// Display remaining TODOs
console.log(`${BOLD_GREEN}=== REMAINING TODOs (in modified files) ===${NC}`);
if (!displayTodosWithLinks(remainingByFile, repoRoot, '•')) {
  console.log('  No remaining TODOs in modified files');
}

// Exit with status 1 if there are added TODOs
if (addedByFile.size > 0) {
  process.exit(1);
}
