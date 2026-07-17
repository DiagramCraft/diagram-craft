import {
  type ASTNode,
  type ASTNodeOfType,
  type BlockParser,
  InlineParser,
  type Parser,
  type ParserState
} from '@diagram-craft/markdown';
import { markdownEngine } from './markdownAstUtils';
import { MDX_COMPONENTS, getMdxSpec, type MdxComponentName } from '../mdx-components/mdxRegistry';

const JSX_BLOCK_RE = /^\s*<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>\s*$/;
const INLINE_JSX_RE = /<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>/g;
const JSX_OPEN_RE = /^\s*<([A-Z][A-Za-z0-9]*)(\s[^>]*)?>\s*$/;
const jsxCloseRe = (name: string) => new RegExp(`^\\s*</${name}>\\s*$`);
const SAFE_PROP_NAME = /^[a-zA-Z0-9_-]+$/;
// Allows parens so CSS color functions (e.g. `oklch(0.62 0.13 145)`) survive as prop values.
const SAFE_PROP_VALUE = /^[a-zA-Z0-9_\-.,()%\s]*$/;

const isKnownComponent = (name: string): name is MdxComponentName => name in MDX_COMPONENTS;

const validateProps = (
  name: MdxComponentName,
  props: Record<string, string>
): Record<string, string> => {
  const validated: Record<string, string> = {};
  const allowedProps = MDX_COMPONENTS[name].allowedProps;
  for (const [key, value] of Object.entries(props)) {
    if (
      SAFE_PROP_NAME.test(key) &&
      SAFE_PROP_VALUE.test(value) &&
      allowedProps.includes(key as (typeof allowedProps)[number])
    ) {
      validated[key] = value;
    } else if (import.meta.env?.DEV) {
      console.warn(
        `[MDX] Prop "${key}"="${value}" was filtered for <${name}> — not in allowedProps or failed prop name/value validation`
      );
    }
  }
  return validated;
};

const parseJsxProps = (rawProps: string, parser: Parser): Record<string, string> => {
  const result: Record<string, string> = {};
  const re = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawProps)) !== null) {
    const key = match[1];
    if (!key) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    result[key] = parser.unescape(value);
  }
  return result;
};

const makeComponentNode = (
  parser: Parser,
  subtype: 'inline' | 'block',
  name: MdxComponentName,
  rawProps: string | undefined,
  source: string,
  children?: ASTNode[]
): ASTNode => {
  const props = validateProps(name, parseJsxProps(rawProps ?? '', parser));
  return {
    type: 'component',
    subtype,
    name,
    props: MDX_COMPONENTS[name].normalizeProps?.(props) ?? props,
    source,
    ...(children ? { children } : {})
  };
};

/**
 * Handles block-level MDX components that use an open/close tag pair rather
 * than a self-closing tag, since they carry markdown content between the
 * tags. Registered ahead of MdxComponentBlockHandler so it gets first refusal
 * on non-self-closing tags. Covers two distinct shapes:
 *
 * - `acceptsChildren` wrappers (e.g. Caption): accept exactly one other
 *   block-level, non-wrapper MDX component as their child.
 * - `acceptsRichContent` containers (e.g. Callout): accept arbitrary parsed
 *   markdown content (paragraphs, lists, nested components, etc.) as-is.
 */
class MdxComponentWrapperBlockHandler implements BlockParser {
  parse(parser: Parser, stream: Parameters<BlockParser['parse']>[1], ast: ASTNode[]): boolean {
    const openLine = stream.peek().text ?? '';
    const match = openLine.match(JSX_OPEN_RE);
    if (!match) return false;

    const name = match[1];
    if (!name || !isKnownComponent(name)) return false;
    const spec = getMdxSpec(name);
    if (spec.mode !== 'block' || (!spec.acceptsChildren && !spec.acceptsRichContent)) return false;

    stream.consume();

    const closeRe = jsxCloseRe(name);
    const innerLines: string[] = [];
    let foundClose = false;
    while (!stream.peek().isEOS()) {
      if (stream.peek().match(closeRe)) {
        foundClose = true;
        break;
      }
      innerLines.push(stream.consume().text ?? '');
    }

    if (!foundClose) {
      // Unclosed tag: degrade to literal text rather than hanging or dropping content.
      ast.push({ type: 'literal', value: parser.unescape(openLine) });
      return true;
    }
    stream.consume(); // consume the closing tag line

    const innerAst = parseMarkdownWithComponents(innerLines.join('\n'));

    if (spec.acceptsRichContent) {
      const children = innerAst.filter(n => !(n.type === 'literal' && n.value.trim() === ''));
      ast.push(
        makeComponentNode(parser, 'block', name, match[2], parser.unescape(openLine), children)
      );
      return true;
    }

    const isComponentNode = (n: ASTNode): n is ASTNodeOfType<'component'> => n.type === 'component';
    const componentChildren = innerAst.filter(isComponentNode);
    const otherContent = innerAst.filter(
      n => n.type !== 'component' && !(n.type === 'literal' && n.value.trim() === '')
    );

    const child = componentChildren[0];
    const isValidChild =
      componentChildren.length === 1 &&
      otherContent.length === 0 &&
      !!child &&
      isKnownComponent(child.name) &&
      getMdxSpec(child.name).mode === 'block' &&
      !getMdxSpec(child.name).acceptsChildren;

    if (!isValidChild || !child) {
      ast.push({ type: 'literal', value: parser.unescape(openLine) });
      return true;
    }

    ast.push(
      makeComponentNode(parser, 'block', name, match[2], parser.unescape(openLine), [child])
    );
    return true;
  }

  excludeFromSubparse(context: string[]): boolean {
    return context.includes('paragraph');
  }
}

class MdxComponentBlockHandler implements BlockParser {
  parse(parser: Parser, stream: Parameters<BlockParser['parse']>[1], ast: ASTNode[]): boolean {
    const line = stream.peek().text ?? '';
    const match = line.match(JSX_BLOCK_RE);
    if (!match) return false;

    const name = match[1];
    if (!name || !isKnownComponent(name)) return false;
    if (MDX_COMPONENTS[name].mode !== 'block') return false;

    ast.push(makeComponentNode(parser, 'block', name, match[2], parser.unescape(line)));
    stream.consume();
    return true;
  }

  excludeFromSubparse(context: string[]): boolean {
    return context.includes('paragraph');
  }
}

class MdxComponentInlineHandler extends InlineParser {
  excludeFromSubparse(context: string[]) {
    return context.includes('code');
  }

  parse(parser: Parser, s: string, parserState: ParserState): ASTNode[] {
    return this.applyInlineRegExp(parser, parserState, s, INLINE_JSX_RE, match => {
      const name = match[1];
      if (!name || !isKnownComponent(name)) return null;
      return makeComponentNode(parser, 'inline', name, match[2], parser.unescape(match[0]));
    });
  }
}

export const parseMarkdownWithComponents = (body: string): ASTNode[] => {
  return markdownEngine
    .parser('gfm', {
      block: [new MdxComponentWrapperBlockHandler(), new MdxComponentBlockHandler()],
      inline: [new MdxComponentInlineHandler()]
    })
    .parse(body);
};

export const removeFirstHeading = (nodes: ASTNode[], withoutFirstHeading: boolean): ASTNode[] => {
  if (!withoutFirstHeading) return nodes;
  const headingIndex = nodes.findIndex(node => node.type === 'heading' && node.level === 1);
  return headingIndex >= 0 ? nodes.filter((_, index) => index !== headingIndex) : nodes;
};

export const parseMarkdownPreview = (body: string, withoutFirstHeading = false): ASTNode[] => {
  return removeFirstHeading(parseMarkdownWithComponents(body), withoutFirstHeading);
};
