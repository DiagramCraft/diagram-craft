import { createElement, useMemo, type ReactNode } from 'react';
import { parseMarkdown, type ASTNode } from '@diagram-craft/markdown';

export type SafeMarkdownClassNames = Partial<
  Record<
    | 'root'
    | 'paragraph'
    | 'gap'
    | 'list'
    | 'inlineCode'
    | 'link'
    | 'codeBlock'
    | 'codeLanguage'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'tableWrap'
    | 'table',
    string
  >
>;

type RenderOptions = {
  classNames: SafeMarkdownClassNames;
  onEntityLink?: (entityId: string) => void;
};

const textContent = (nodes: ASTNode[]): string =>
  nodes
    .map(node =>
      node.type === 'literal'
        ? node.value
        : 'children' in node && node.children
          ? textContent(node.children)
          : ''
    )
    .join('');

const renderNodes = (nodes: ASTNode[], keyPrefix: string, options: RenderOptions): ReactNode[] =>
  nodes.flatMap((node, index) => renderNode(node, `${keyPrefix}-${index}`, options));

const renderNode = (node: ASTNode, key: string, options: RenderOptions): ReactNode[] => {
  const children = 'children' in node ? (node.children ?? []) : [];
  const rendered = () => renderNodes(children, key, options);
  const classes = options.classNames;
  switch (node.type) {
    case 'literal':
      return [node.value];
    case 'paragraph':
      return [
        <p key={key} className={classes.paragraph}>
          {rendered()}
        </p>
      ];
    case 'heading': {
      const level = Math.min(6, Math.max(1, node.level ?? 1));
      const heading = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return [
        createElement(
          heading,
          {
            key,
            className:
              level === 1
                ? classes.heading1
                : level === 2
                  ? classes.heading2
                  : level === 3
                    ? classes.heading3
                    : undefined
          },
          rendered()
        )
      ];
    }
    case 'list': {
      const isChecklist = children.some(
        child => child.type === 'item' && typeof child.checked === 'boolean'
      );
      return [
        node.subtype === 'ordered' ? (
          <ol
            key={key}
            className={(() => {
              const className = `${classes.list ?? ''}${isChecklist ? ' task-list' : ''}`.trim();
              return className === '' ? undefined : className;
            })()}
          >
            {rendered()}
          </ol>
        ) : (
          <ul
            key={key}
            className={(() => {
              const className = `${classes.list ?? ''}${isChecklist ? ' task-list' : ''}`.trim();
              return className === '' ? undefined : className;
            })()}
          >
            {rendered()}
          </ul>
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
          {rendered()}
        </li>
      ];
    }
    case 'code':
      return node.inline
        ? [
            <code key={key} className={classes.inlineCode}>
              {rendered()}
            </code>
          ]
        : [
            <pre key={key} className={classes.codeBlock}>
              <code>{rendered()}</code>
            </pre>
          ];
    case 'link': {
      const href = node.href ?? '';
      if (href.startsWith('entity:')) {
        const entityId = href.slice('entity:'.length);
        return [
          <button
            key={key}
            type="button"
            className={classes.link}
            onClick={() => options.onEntityLink?.(entityId)}
          >
            {rendered()}
          </button>
        ];
      }
      if (/^https?:\/\//i.test(href)) {
        return [
          <a key={key} className={classes.link} href={href} target="_blank" rel="noreferrer">
            {rendered()}
          </a>
        ];
      }
      return [node.source ?? textContent(children)];
    }
    case 'emphasis':
      return [<em key={key}>{rendered()}</em>];
    case 'strong':
      return [<strong key={key}>{rendered()}</strong>];
    case 'strikethrough':
      return [<del key={key}>{rendered()}</del>];
    case 'blockquote':
      return [<blockquote key={key}>{rendered()}</blockquote>];
    case 'line-break':
      return [<br key={key} />];
    case 'hr':
      return [<hr key={key} />];
    case 'table':
      return [
        <div key={key} className={classes.tableWrap}>
          <table className={classes.table}>
            <tbody>{rendered()}</tbody>
          </table>
        </div>
      ];
    case 'table-row':
      return [<tr key={key}>{rendered()}</tr>];
    case 'table-cell':
      return node.header ? [<th key={key}>{rendered()}</th>] : [<td key={key}>{rendered()}</td>];
    case 'image':
      return node.href && /^https?:\/\//i.test(node.href)
        ? [<img key={key} src={node.href} alt={textContent(children)} title={node.title} />]
        : [];
    case 'small':
      return [<small key={key}>{rendered()}</small>];
    default:
      return [];
  }
};

export const SafeMarkdown = ({
  text,
  classNames = {},
  onEntityLink
}: {
  text: string;
  classNames?: SafeMarkdownClassNames;
  onEntityLink?: (entityId: string) => void;
}) => {
  const nodes = useMemo(() => parseMarkdown(text, 'gfm'), [text]);
  return (
    <div className={classNames.root}>{renderNodes(nodes, 'md', { classNames, onEntityLink })}</div>
  );
};
