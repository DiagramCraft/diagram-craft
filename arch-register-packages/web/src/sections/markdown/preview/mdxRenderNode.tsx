import React, { type ReactNode } from 'react';
import { type ASTNode } from '@diagram-craft/markdown';
import { getMdxSpec, type MdxComponentName } from '../mdx-components/mdxRegistry';

/** A highlighted comment anchor, in the same plain-text offset space as `renderText`. Ranges must be sorted and non-overlapping. */
export type HighlightRange = { commentId: string; start: number; end: number };

export type HighlightHandlers = {
  activeCommentId?: string | null;
  onMarkClick?: (commentId: string) => void;
};

type RenderCtx = {
  ranges: HighlightRange[];
  cursor: { pos: number };
} & HighlightHandlers;

export const renderNodes = (nodes: ASTNode[], keyPrefix: string, ctx?: RenderCtx): ReactNode[] => {
  return nodes.flatMap((node, index) => renderNode(node, `${keyPrefix}-${index}`, ctx));
};

export const renderText = (nodes: ASTNode[]): string => {
  return nodes
    .map(node => {
      if (node.type === 'literal') return node.value;
      if ('children' in node && node.children) return renderText(node.children);
      return '';
    })
    .join('');
};

/**
 * Splits `text` (which starts at plain-text offset `offset`) into segments, tagging each
 * segment with the id of the highlight range that covers it, if any. Ranges are assumed
 * sorted and non-overlapping. Pure/DOM-free so it can be unit tested directly.
 */
export const splitTextWithRanges = (
  text: string,
  offset: number,
  ranges: HighlightRange[]
): { text: string; commentId?: string }[] => {
  const end = offset + text.length;
  const overlapping = ranges.filter(r => r.start < end && r.end > offset);
  if (overlapping.length === 0) return [{ text }];

  const boundaries = new Set<number>([offset, end]);
  for (const r of overlapping) {
    boundaries.add(Math.max(offset, r.start));
    boundaries.add(Math.min(end, r.end));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: { text: string; commentId?: string }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i]!;
    const segEnd = sorted[i + 1]!;
    if (segStart === segEnd) continue;
    const covering = overlapping.find(r => r.start <= segStart && r.end >= segEnd);
    segments.push({
      text: text.slice(segStart - offset, segEnd - offset),
      commentId: covering?.commentId
    });
  }
  return segments;
};

const renderLiteral = (value: string, key: string, ctx?: RenderCtx): ReactNode[] => {
  if (!ctx) return [value];

  const startPos = ctx.cursor.pos;
  ctx.cursor.pos += value.length;

  if (ctx.ranges.length === 0) return [value];

  const segments = splitTextWithRanges(value, startPos, ctx.ranges);
  if (segments.length === 1 && segments[0]!.commentId === undefined) return [value];

  return segments.map((segment, i) =>
    segment.commentId ? (
      <mark
        key={`${key}-seg${i}`}
        data-comment-id={segment.commentId}
        className={
          segment.commentId === ctx.activeCommentId ? 'wiki-comment-mark-active' : undefined
        }
        onClick={() => ctx.onMarkClick?.(segment.commentId!)}
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    )
  );
};

const renderNode = (node: ASTNode, key: string, ctx?: RenderCtx): ReactNode[] => {
  switch (node.type) {
    case 'literal':
      return renderLiteral(node.value, key, ctx);

    case 'component': {
      const spec = getMdxSpec(node.name as MdxComponentName);
      if (!spec) return [];
      const Component = spec.component as unknown as React.ComponentType<
        Record<string, unknown> & { children?: ReactNode }
      >;
      const kids = node.children?.length ? renderNodes(node.children, key, ctx) : undefined;
      return [
        <Component key={key} {...node.props}>
          {kids}
        </Component>
      ];
    }

    case 'heading': {
      const level = Math.min(6, Math.max(1, node.level ?? 1));
      return [
        React.createElement(`h${level}`, { key }, renderNodes(node.children ?? [], key, ctx))
      ];
    }

    case 'paragraph':
      return [<p key={key}>{renderNodes(node.children ?? [], key, ctx)}</p>];

    case 'list': {
      const isChecklist = node.children?.some(
        child => child.type === 'item' && typeof child.checked === 'boolean'
      );
      return [
        React.createElement(
          node.subtype === 'ordered' ? 'ol' : 'ul',
          { key, className: isChecklist ? 'task-list' : undefined },
          renderNodes(node.children ?? [], key, ctx)
        )
      ];
    }

    case 'item': {
      const isChecklistItem = typeof node.checked === 'boolean';
      return [
        <li key={key} className={isChecklistItem ? 'task-list-item' : undefined}>
          {isChecklistItem && (
            <input
              type="checkbox"
              checked={node.checked}
              disabled
              aria-label={node.checked ? 'Completed task' : 'Incomplete task'}
            />
          )}
          {renderNodes(node.children ?? [], key, ctx)}
        </li>
      ];
    }

    case 'code':
      if (node.inline) {
        return [<code key={key}>{renderNodes(node.children ?? [], key, ctx)}</code>];
      }
      return [
        <pre key={key}>
          <code>{renderNodes(node.children ?? [], key, ctx)}</code>
        </pre>
      ];

    case 'line-break':
      return [<br key={key} />];

    case 'link':
      return node.href
        ? [
            <a key={key} href={node.href} title={node.title}>
              {renderNodes(node.children ?? [], key, ctx)}
            </a>
          ]
        : renderLiteral(node.source ?? '', key, ctx);

    case 'image':
      return node.href
        ? [
            <img
              key={key}
              src={node.href}
              alt={renderText(node.children ?? [])}
              title={node.title}
            />
          ]
        : renderLiteral(node.source ?? '', key, ctx);

    case 'emphasis':
      return [<em key={key}>{renderNodes(node.children ?? [], key, ctx)}</em>];

    case 'strong':
      return [<strong key={key}>{renderNodes(node.children ?? [], key, ctx)}</strong>];

    case 'strikethrough':
      return [<del key={key}>{renderNodes(node.children ?? [], key, ctx)}</del>];

    case 'small':
      return [<small key={key}>{renderNodes(node.children ?? [], key, ctx)}</small>];

    case 'blockquote':
      return [<blockquote key={key}>{renderNodes(node.children ?? [], key, ctx)}</blockquote>];

    case 'html':
      if (node.subtype === 'comment' || !node.html?.trim()) return [];
      return [<div key={key} dangerouslySetInnerHTML={{ __html: node.html }} />];

    case 'hr':
      return [<hr key={key} />];

    case 'link-definition':
      return [];

    case 'table': {
      const rows = node.children ?? [];
      const headerRows = rows.filter(
        r => r.type === 'table-row' && (r as { header?: boolean }).header
      );
      const bodyRows = rows.filter(
        r => r.type === 'table-row' && !(r as { header?: boolean }).header
      );
      return [
        <table key={key}>
          {headerRows.length > 0 && (
            <thead>
              {headerRows.map((r, i) => (
                <tr key={`${key}-h${i}`}>{renderNodes(r.children ?? [], `${key}-h${i}`, ctx)}</tr>
              ))}
            </thead>
          )}
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((r, i) => (
                <tr key={`${key}-b${i}`}>{renderNodes(r.children ?? [], `${key}-b${i}`, ctx)}</tr>
              ))}
            </tbody>
          )}
        </table>
      ];
    }

    case 'table-row':
      return [<tr key={key}>{renderNodes(node.children ?? [], key, ctx)}</tr>];

    case 'table-cell':
      return node.header
        ? [<th key={key}>{renderNodes(node.children ?? [], key, ctx)}</th>]
        : [<td key={key}>{renderNodes(node.children ?? [], key, ctx)}</td>];

    default:
      return [];
  }
};

export const renderMarkdownPreview = (
  nodes: ASTNode[],
  ranges: HighlightRange[] = [],
  handlers: HighlightHandlers = {}
): ReactNode => {
  const ctx: RenderCtx | undefined =
    ranges.length > 0 ? { ranges, cursor: { pos: 0 }, ...handlers } : undefined;
  return <>{renderNodes(nodes, 'mdx', ctx)}</>;
};
