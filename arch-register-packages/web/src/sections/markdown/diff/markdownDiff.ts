import { MarkdownEngine, parseMarkdown } from '@diagram-craft/markdown';

type ASTNode = ReturnType<typeof parseMarkdown>[number];

export type DiffRow =
  | { kind: 'unchanged'; html: string }
  | { kind: 'added'; html: string }
  | { kind: 'removed'; html: string }
  | { kind: 'modified'; baseHtml: string; targetHtml: string; inlineHtml: string };

const markdownEngine = new MarkdownEngine();

const flattenText = (nodes: ASTNode['children']): string => {
  if (!nodes) return '';
  return nodes
    .map(n => (n.type === 'literal' ? n.value : flattenText(n.children)))
    .join('');
};

const blockSignature = (node: ASTNode): string => {
  const level = node.type === 'heading' ? String(node.level) : '';
  return `${node.type}${level}:${flattenText(node.children).trim().toLowerCase()}`;
};

const blockTypeKey = (node: ASTNode): string => {
  const level = node.type === 'heading' ? String(node.level) : '';
  return `${node.type}${level}`;
};

const renderNode = (node: ASTNode): string => markdownEngine.toHTML([node]);

// Standard LCS length table
const lcsTable = (a: string[], b: string[]): number[][] => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
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

const splitOuterTag = (html: string): [string, string, string] => {
  const trimmed = html.trim();
  const openMatch = trimmed.match(/^(<[^>]+>)/);
  if (!openMatch?.[1]) return ['', trimmed, ''];
  const openTag = openMatch[1];
  const tagName = openTag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
  if (!tagName) return ['', trimmed, ''];
  const closeTag = `</${tagName}>`;
  if (trimmed.endsWith(closeTag)) {
    return [openTag, trimmed.slice(openTag.length, -closeTag.length), closeTag];
  }
  return ['', trimmed, ''];
};

const DEL_STYLE =
  'background:rgba(239,68,68,0.18);color:#b91c1c;text-decoration:line-through;border-radius:2px;';
const INS_STYLE =
  'background:rgba(34,197,94,0.18);color:#15803d;text-decoration:none;border-radius:2px;';

const computeInlineDiff = (baseHtml: string, targetHtml: string): string => {
  const [openTag, baseInner, closeTag] = splitOuterTag(baseHtml);
  const [, targetInner] = splitOuterTag(targetHtml);

  const baseTokens = baseInner.match(/\S+|\s+/g) ?? [];
  const targetTokens = targetInner.match(/\S+|\s+/g) ?? [];
  const dp = lcsTable(baseTokens, targetTokens);

  let i = baseTokens.length;
  let j = targetTokens.length;
  const parts: string[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && baseTokens[i - 1] === targetTokens[j - 1]) {
      parts.unshift(baseTokens[i - 1]!);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      parts.unshift(`<ins style="${INS_STYLE}">${targetTokens[j - 1]}</ins>`);
      j--;
    } else {
      parts.unshift(`<del style="${DEL_STYLE}">${baseTokens[i - 1]}</del>`);
      i--;
    }
  }

  return `${openTag}${parts.join('')}${closeTag}`;
};

const collapseModified = (ops: EditOp[]): DiffRow[] => {
  const rows: DiffRow[] = [];
  let idx = 0;

  while (idx < ops.length) {
    const op = ops[idx]!;

    if (op.op === 'keep') {
      rows.push({ kind: 'unchanged', html: renderNode(op.base) });
      idx++;
      continue;
    }

    // Look ahead: remove followed by add of same block type → modified
    if (
      op.op === 'remove' &&
      idx + 1 < ops.length &&
      ops[idx + 1]!.op === 'add' &&
      blockTypeKey(op.base) === blockTypeKey((ops[idx + 1] as { op: 'add'; target: ASTNode }).target)
    ) {
      const next = ops[idx + 1] as { op: 'add'; target: ASTNode };
      const baseHtml = renderNode(op.base);
      const targetHtml = renderNode(next.target);
      rows.push({
        kind: 'modified',
        baseHtml,
        targetHtml,
        inlineHtml: computeInlineDiff(baseHtml, targetHtml),
      });
      idx += 2;
      continue;
    }

    if (op.op === 'remove') {
      rows.push({ kind: 'removed', html: renderNode(op.base) });
      idx++;
      continue;
    }

    // op === 'add'
    rows.push({ kind: 'added', html: renderNode(op.target) });
    idx++;
  }

  return rows;
};

export const diffMarkdown = (baseBody: string, targetBody: string): DiffRow[] => {
  const baseNodes = parseMarkdown(baseBody);
  const targetNodes = parseMarkdown(targetBody);
  const ops = diffNodes(baseNodes, targetNodes);
  return collapseModified(ops);
};
