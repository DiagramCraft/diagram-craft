import { parseMarkdown, MarkdownEngine } from '@diagram-craft/markdown';
import { MDX_COMPONENTS } from './mdxComponents';

const engine = new MarkdownEngine();

// Matches a line that is entirely a self-closing JSX component tag, e.g.:
//   <EntityCard id="payment-service" />
const JSX_LINE_RE = /^\s*<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>\s*$/;

// Validation patterns for prop names and values
const SAFE_PROP_NAME = /^[a-zA-Z0-9_-]+$/;
const SAFE_PROP_VALUE = /^[a-zA-Z0-9_\-.,\s]*$/;

const validateProps = (props: Record<string, string>): Record<string, string> => {
  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (SAFE_PROP_NAME.test(key) && SAFE_PROP_VALUE.test(value)) {
      validated[key] = value;
    }
  }
  return validated;
};

// Minimal JSX attribute parser: extracts prop="value" pairs from a props string
const parseJsxProps = (rawProps: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const re = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawProps)) !== null) {
    result[m[1]!] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return result;
};

type Segment =
  | { type: 'md'; text: string }
  | { type: 'jsx'; componentName: string; props: Record<string, string> };

const splitMdxSegments = (body: string): Segment[] => {
  const lines = body.split('\n');
  const segments: Segment[] = [];
  const mdLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      mdLines.push(line);
      continue;
    }

    if (!inCodeBlock) {
      const m = JSX_LINE_RE.exec(line);
      if (m) {
        if (mdLines.length > 0) {
          segments.push({ type: 'md', text: mdLines.join('\n') });
          mdLines.length = 0;
        }
        segments.push({
          type: 'jsx',
          componentName: m[1]!,
          props: parseJsxProps(m[2] ?? ''),
        });
        continue;
      }
    }

    mdLines.push(line);
  }

  if (mdLines.length > 0) {
    segments.push({ type: 'md', text: mdLines.join('\n') });
  }

  return segments;
};

const renderMd = (text: string, stripFirstH1: boolean): string => {
  const ast = parseMarkdown(text);
  if (!stripFirstH1) {
    return engine.toHTML(ast);
  }
  const h1Idx = ast.findIndex(n => n.type === 'heading' && n.level === 1);
  const filtered = h1Idx >= 0 ? ast.filter((_, i) => i !== h1Idx) : ast;
  return engine.toHTML(filtered);
};

type MdxPreviewProps = {
  body: string;
  withoutFirstHeading?: boolean;
};

export const MdxPreview = ({ body, withoutFirstHeading = false }: MdxPreviewProps) => {
  if (!body.trim()) return null;

  const segments = splitMdxSegments(body);
  let firstMdSeen = false;

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'jsx') {
          const Component = MDX_COMPONENTS[seg.componentName];
          if (!Component) return null;
          // Validate props before spreading to prevent injection attacks
          return <Component key={i} {...validateProps(seg.props)} />;
        }

        const isFirstMd = !firstMdSeen;
        firstMdSeen = true;
        const html = renderMd(seg.text, withoutFirstHeading && isFirstMd);
        if (!html.trim()) return null;
        // eslint-disable-next-line react/no-danger
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </>
  );
};
