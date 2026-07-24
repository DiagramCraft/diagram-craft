import type { ASTNode } from '@diagram-craft/markdown';
import { markdownEngine, flattenNodeText } from '../preview/markdownAstUtils';
import { parseMarkdownWithComponents } from '../preview/mdxMarkdown';

export type DiffRow =
  | { kind: 'unchanged'; nodes: ASTNode[] }
  | { kind: 'added'; nodes: ASTNode[] }
  | { kind: 'removed'; nodes: ASTNode[] }
  | { kind: 'modified'; baseHtml: string; targetHtml: string; inlineHtml: string };

// Attributes that don't show up in flattened text (link/image href & title, raw html,
// embedded component source, ...) but still constitute a real change. Collected separately
// from the fuzzy (trimmed/lowercased) text comparison below so e.g. a link whose visible
// text is unchanged but whose href changed is still recognized as modified rather than
// silently treated as identical.
const attributeFingerprint = (node: ASTNode): string => {
  const own = ((): string => {
    switch (node.type) {
      case 'link':
      case 'image':
        return `${node.type}(${node.href ?? ''}|${node.title ?? ''})`;
      case 'html':
        return `html(${node.html ?? ''})`;
      case 'code':
        return `code(${node.inline ? 'i' : 'b'}|${node.source ?? ''})`;
      case 'item':
        return `item(${node.checked ?? ''})`;
      case 'table-cell':
        return `cell(${node.align ?? ''}|${node.header ?? ''})`;
      default:
        return '';
    }
  })();
  return `${own}${(node.children ?? []).map(attributeFingerprint).join('')}`;
};

const blockSignature = (node: ASTNode): string => {
  if (node.type === 'component') return `component:${node.name}:${node.source}`;
  const level = node.type === 'heading' ? String(node.level) : '';
  return `${node.type}${level}:${flattenNodeText(node.children).trim().toLowerCase()}:${attributeFingerprint(node)}`;
};

const blockTypeKey = (node: ASTNode): string => {
  const level = node.type === 'heading' ? String(node.level) : '';
  return `${node.type}${level}`;
};

const renderNode = (node: ASTNode): string => markdownEngine.toHTML([node]);

const lcsTable = (a: string[], b: string[]): number[][] => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp;
};

type EditOp =
  | { op: 'keep'; base: ASTNode; target: ASTNode }
  | { op: 'remove'; base: ASTNode }
  | { op: 'add'; target: ASTNode };

const diffNodes = (baseNodes: ASTNode[], targetNodes: ASTNode[]): EditOp[] => {
  const baseSigs = baseNodes.map(blockSignature);
  const targetSigs = targetNodes.map(blockSignature);
  const dp = lcsTable(baseSigs, targetSigs);

  const ops: EditOp[] = [];
  let i = baseNodes.length;
  let j = targetNodes.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && baseSigs[i - 1] === targetSigs[j - 1]) {
      ops.unshift({ op: 'keep', base: baseNodes[i - 1]!, target: targetNodes[j - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.unshift({ op: 'add', target: targetNodes[j - 1]! });
      j--;
    } else {
      ops.unshift({ op: 'remove', base: baseNodes[i - 1]! });
      i--;
    }
  }

  return ops;
};

// Sentinel used to locate the "shell" (opening/closing markup) a container node renders
// around its children, without guessing at HTML syntax. Rendering an ASTNode with its
// children replaced by a single literal token containing this marker, then locating that
// marker in the rendered output, reuses the real renderer for attribute/tag handling and
// guarantees we only ever splice complete, independently-rendered subtrees into <ins>/<del> —
// never a partial tag or attribute (the malformed-HTML bug this replaces).
const DIFF_MARKER = 'DCM';

const tryShell = (node: ASTNode): [string, string] | null => {
  const probe = { ...node, children: [{ type: 'literal', value: DIFF_MARKER } as ASTNode] };
  const html = renderNode(probe);
  const idx = html.indexOf(DIFF_MARKER);
  if (idx === -1 || html.indexOf(DIFF_MARKER, idx + DIFF_MARKER.length) !== -1) return null;
  return [html.slice(0, idx), html.slice(idx + DIFF_MARKER.length)];
};

type Unit = { kind: 'text'; value: string } | { kind: 'node'; node: ASTNode; sig: string };

// Identifies the "shape" of a non-text node for alignment purposes. Wrapper/formatting
// nodes (strong, emphasis, ...) are keyed by type alone so they align regardless of their
// content, and their children are diffed recursively. Nodes whose identity depends on an
// attribute (link/image href, raw html, embedded component source, ...) include that
// attribute in the key so a changed attribute is treated as a whole remove+add rather than
// being spliced into.
const nodeSignature = (n: ASTNode): string => {
  switch (n.type) {
    case 'link':
    case 'image':
      return `${n.type}:${n.href ?? ''}:${n.title ?? ''}`;
    case 'html':
      return `html:${n.html ?? ''}`;
    case 'component':
      return `component:${n.name}:${n.source}`;
    case 'code':
      return `code:${n.inline ? 'inline' : 'block'}:${n.source ?? flattenNodeText(n.children ?? [])}`;
    case 'item':
      return `item:${n.checked ?? ''}`;
    case 'heading':
      return `heading:${n.level}`;
    case 'list':
      return `list:${n.subtype}`;
    case 'table-cell':
      return `table-cell:${n.align ?? ''}:${n.header ?? ''}`;
    default:
      return n.type;
  }
};

// The renderer passes raw `<tag ...>`/`</tag>`-shaped runs inside literal text through
// unescaped (see HTMLRenderer.createHtmlEntities), so plain markdown text can itself carry
// inline raw HTML. A naive whitespace split would happily cut such a run in half (e.g.
// separating `<div` from `class="x">`), so any complete tag is pulled out as one atomic
// token up front and never split by the surrounding whitespace tokenizer.
const TAG_RE = /<\/?[a-zA-Z][^<>]*>/g;

const tokenizeLiteral = (value: string): Unit[] => {
  const units: Unit[] = [];
  let lastIndex = 0;
  for (const m of value.matchAll(TAG_RE)) {
    const idx = m.index;
    if (idx > lastIndex) {
      for (const t of value.slice(lastIndex, idx).match(/\S+|\s+/g) ?? []) {
        units.push({ kind: 'text', value: t });
      }
    }
    units.push({ kind: 'text', value: m[0] });
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < value.length) {
    for (const t of value.slice(lastIndex).match(/\S+|\s+/g) ?? []) {
      units.push({ kind: 'text', value: t });
    }
  }
  return units;
};

const tokenize = (nodes: ASTNode[]): Unit[] =>
  nodes.flatMap((n): Unit[] =>
    n.type === 'literal'
      ? tokenizeLiteral(n.value)
      : [{ kind: 'node', node: n, sig: nodeSignature(n) }]
  );

const unitKey = (u: Unit): string => (u.kind === 'text' ? `t:${u.value}` : `n:${u.sig}`);

// Rendering a lone literal node through the full engine trims/drops whitespace-only output
// (see HTMLRenderer.processNodeArray), which would silently swallow whitespace-only tokens.
// Plain whitespace never needs entity escaping, so emit it verbatim instead.
const renderUnit = (u: Unit): string => {
  if (u.kind === 'text') {
    return /^\s+$/.test(u.value) ? u.value : renderNode({ type: 'literal', value: u.value });
  }
  return renderNode(u.node);
};

const diffChildren = (baseChildren: ASTNode[], targetChildren: ASTNode[]): string => {
  const baseUnits = tokenize(baseChildren);
  const targetUnits = tokenize(targetChildren);
  const dp = lcsTable(baseUnits.map(unitKey), targetUnits.map(unitKey));

  let i = baseUnits.length;
  let j = targetUnits.length;
  const parts: string[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && unitKey(baseUnits[i - 1]!) === unitKey(targetUnits[j - 1]!)) {
      const base = baseUnits[i - 1]!;
      const target = targetUnits[j - 1]!;
      if (base.kind === 'node' && target.kind === 'node') {
        const shell = tryShell(base.node);
        parts.unshift(
          shell
            ? `${shell[0]}${diffChildren(base.node.children ?? [], target.node.children ?? [])}${shell[1]}`
            : renderUnit(base)
        );
      } else {
        parts.unshift(renderUnit(base));
      }
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      parts.unshift(`<ins>${renderUnit(targetUnits[j - 1]!)}</ins>`);
      j--;
    } else {
      parts.unshift(`<del>${renderUnit(baseUnits[i - 1]!)}</del>`);
      i--;
    }
  }

  return parts.join('');
};

const computeInlineDiff = (base: ASTNode, target: ASTNode): string => {
  const shell = tryShell(base);
  if (shell) {
    return `${shell[0]}${diffChildren(base.children ?? [], target.children ?? [])}${shell[1]}`;
  }
  // Not a container node (no place to splice children in) — fall back to whole-node replace.
  return `<del>${renderNode(base)}</del><ins>${renderNode(target)}</ins>`;
};

const collapseModified = (ops: EditOp[]): DiffRow[] => {
  const rows: DiffRow[] = [];
  let idx = 0;

  while (idx < ops.length) {
    const op = ops[idx]!;

    if (op.op === 'keep') {
      rows.push({ kind: 'unchanged', nodes: [op.base] });
      idx++;
      continue;
    }

    if (
      op.op === 'remove' &&
      idx + 1 < ops.length &&
      ops[idx + 1]!.op === 'add' &&
      blockTypeKey(op.base) ===
        blockTypeKey((ops[idx + 1] as { op: 'add'; target: ASTNode }).target)
    ) {
      const next = ops[idx + 1] as { op: 'add'; target: ASTNode };
      rows.push({
        kind: 'modified',
        baseHtml: renderNode(op.base),
        targetHtml: renderNode(next.target),
        inlineHtml: computeInlineDiff(op.base, next.target)
      });
      idx += 2;
      continue;
    }

    if (op.op === 'remove') {
      rows.push({ kind: 'removed', nodes: [op.base] });
      idx++;
      continue;
    }

    rows.push({ kind: 'added', nodes: [op.target] });
    idx++;
  }

  return rows;
};

export const diffMarkdown = (baseBody: string, targetBody: string): DiffRow[] => {
  const baseNodes = parseMarkdownWithComponents(baseBody);
  const targetNodes = parseMarkdownWithComponents(targetBody);
  const ops = diffNodes(baseNodes, targetNodes);
  return collapseModified(ops);
};
