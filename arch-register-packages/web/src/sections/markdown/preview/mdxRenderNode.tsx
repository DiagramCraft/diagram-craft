import React, { type ReactNode } from 'react';
import { type ASTNode } from '@diagram-craft/markdown';
import { MDX_COMPONENTS, type MdxComponentName } from '../mdx-components/mdxRegistry';

export const renderNodes = (nodes: ASTNode[], keyPrefix: string): ReactNode[] => {
  return nodes.flatMap((node, index) => renderNode(node, `${keyPrefix}-${index}`));
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

const renderNode = (node: ASTNode, key: string): ReactNode[] => {
  switch (node.type) {
    case 'literal':
      return [node.value];

    case 'component': {
      const spec = MDX_COMPONENTS[node.name as MdxComponentName];
      if (!spec) return [];
      const Component = spec.component;
      return [<Component key={key} {...node.props} />];
    }

    case 'heading': {
      const level = Math.min(6, Math.max(1, node.level ?? 1));
      return [React.createElement(`h${level}`, { key }, renderNodes(node.children ?? [], key))];
    }

    case 'paragraph':
      return [<p key={key}>{renderNodes(node.children ?? [], key)}</p>];

    case 'list': {
      return [
        React.createElement(
          node.subtype === 'ordered' ? 'ol' : 'ul',
          { key },
          renderNodes(node.children ?? [], key)
        )
      ];
    }

    case 'item':
      return [<li key={key}>{renderNodes(node.children ?? [], key)}</li>];

    case 'code':
      if (node.inline) {
        return [<code key={key}>{renderNodes(node.children ?? [], key)}</code>];
      }
      return [
        <pre key={key}>
          <code>{renderNodes(node.children ?? [], key)}</code>
        </pre>
      ];

    case 'line-break':
      return [<br key={key} />];

    case 'link':
      return node.href
        ? [
            <a key={key} href={node.href} title={node.title}>
              {renderNodes(node.children ?? [], key)}
            </a>
          ]
        : [node.source ?? ''];

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
        : [node.source ?? ''];

    case 'emphasis':
      return [<em key={key}>{renderNodes(node.children ?? [], key)}</em>];

    case 'strong':
      return [<strong key={key}>{renderNodes(node.children ?? [], key)}</strong>];

    case 'small':
      return [<small key={key}>{renderNodes(node.children ?? [], key)}</small>];

    case 'blockquote':
      return [<blockquote key={key}>{renderNodes(node.children ?? [], key)}</blockquote>];

    case 'html':
      if (node.subtype === 'comment' || !node.html?.trim()) return [];
      return [<div key={key} dangerouslySetInnerHTML={{ __html: node.html }} />];

    case 'hr':
      return [<hr key={key} />];

    case 'link-definition':
      return [];

    case 'table': {
      const rows = node.children ?? [];
      const headerRows = rows.filter(r => r.type === 'table-row' && (r as { header?: boolean }).header);
      const bodyRows = rows.filter(r => r.type === 'table-row' && !(r as { header?: boolean }).header);
      return [
        <table key={key}>
          {headerRows.length > 0 && (
            <thead>
              {headerRows.map((r, i) => (
                <tr key={`${key}-h${i}`}>{renderNodes(r.children ?? [], `${key}-h${i}`)}</tr>
              ))}
            </thead>
          )}
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((r, i) => (
                <tr key={`${key}-b${i}`}>{renderNodes(r.children ?? [], `${key}-b${i}`)}</tr>
              ))}
            </tbody>
          )}
        </table>
      ];
    }

    case 'table-row':
      return [<tr key={key}>{renderNodes(node.children ?? [], key)}</tr>];

    case 'table-cell':
      return node.header
        ? [<th key={key}>{renderNodes(node.children ?? [], key)}</th>]
        : [<td key={key}>{renderNodes(node.children ?? [], key)}</td>];

    default:
      return [];
  }
};

export const renderMarkdownPreview = (nodes: ASTNode[]): ReactNode => {
  return <>{renderNodes(nodes, 'mdx')}</>;
};
