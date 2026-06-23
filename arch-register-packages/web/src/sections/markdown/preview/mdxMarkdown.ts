import {
  type ASTNode,
  type BlockParser,
  InlineParser,
  MarkdownEngine,
  type Parser,
  type ParserState
} from '@diagram-craft/markdown';
import { MDX_COMPONENTS, type MdxComponentName } from '../mdx-components/mdxRegistry';

const engine = new MarkdownEngine();

const JSX_BLOCK_RE = /^\s*<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>\s*$/;
const INLINE_JSX_RE = /<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>/g;
const SAFE_PROP_NAME = /^[a-zA-Z0-9_-]+$/;
const SAFE_PROP_VALUE = /^[a-zA-Z0-9_\-.,\s]*$/;

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
  source: string
): ASTNode => ({
  type: 'component',
  subtype,
  name,
  props: validateProps(name, parseJsxProps(rawProps ?? '', parser)),
  source
});

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
      if (MDX_COMPONENTS[name].mode !== 'inline') return null;
      return makeComponentNode(parser, 'inline', name, match[2], parser.unescape(match[0]));
    });
  }
}

const parseMarkdownWithComponents = (body: string): ASTNode[] => {
  return engine
    .parser('strict', {
      block: [new MdxComponentBlockHandler()],
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
