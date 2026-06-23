import { useRef, useLayoutEffect, useState, useMemo } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { parseMarkdown, MarkdownEngine } from '@diagram-craft/markdown';
import { MDX_COMPONENTS } from './mdxComponents';

const engine = new MarkdownEngine();

// Matches a line that is entirely a self-closing JSX component tag, e.g.:
//   <EntityCard id="payment-service" />
const JSX_LINE_RE = /^\s*<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>\s*$/;

// Matches any self-closing JSX component tag within text (inline)
const INLINE_JSX_RE = /<([A-Z][A-Za-z0-9]*)(\s[^>]*)?\s*\/>/g;

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

type InlineRef = { componentName: string; props: Record<string, string> };

// Replace known inline JSX components with unique tokens before markdown rendering.
// Unknown component names are left unchanged so the markdown engine sees them as text.
const extractInlineComponents = (
  text: string
): { processed: string; refs: Map<string, InlineRef> } => {
  const refs = new Map<string, InlineRef>();
  let idx = 0;
  const processed = text.replace(
    INLINE_JSX_RE,
    (match, componentName: string, rawProps: string | undefined) => {
      if (!(componentName in MDX_COMPONENTS)) return match;
      const token = `INLINECMP${idx++}`;
      refs.set(token, { componentName, props: parseJsxProps(rawProps ?? '') });
      return token;
    }
  );
  return { processed, refs };
};

// Renders an HTML string that contains inline-component tokens. Sets innerHTML
// imperatively so React never interferes with the DOM, then creates portals into
// the placeholder spans in the same effect run so they always target live nodes.
const InlineHtmlBlock = ({ html, refs }: { html: string; refs: Map<string, InlineRef> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [portals, setPortals] = useState<React.ReactPortal[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let processedHtml = html;
    for (const token of refs.keys()) {
      processedHtml = processedHtml.replace(token, `<span data-ief="${token}"></span>`);
    }
    container.innerHTML = processedHtml;

    const newPortals: React.ReactPortal[] = [];
    for (const [token, ref] of refs.entries()) {
      const target = container.querySelector<Element>(`[data-ief="${token}"]`);
      if (!target) continue;
      const Component = MDX_COMPONENTS[ref.componentName];
      if (!Component) continue;
      newPortals.push(
        createPortal(<Component key={token} {...validateProps(ref.props)} />, target)
      );
    }
    setPortals(newPortals);
  }, [html, refs]);

  return (
    <>
      <div ref={containerRef} />
      {portals}
    </>
  );
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

type ProcessedSegment =
  | { type: 'jsx'; componentName: string; props: Record<string, string>; key: number }
  | { type: 'md-plain'; html: string; key: number }
  | { type: 'md-inline'; html: string; refs: Map<string, InlineRef>; key: number };

type MdxPreviewProps = {
  body: string;
  withoutFirstHeading?: boolean;
};

export const MdxPreview = ({ body, withoutFirstHeading = false }: MdxPreviewProps) => {
  // Memoize all per-segment processing so html/refs refs are stable between parent
  // re-renders — this prevents InlineHtmlBlock from resetting innerHTML unnecessarily.
  const processedSegments = useMemo((): ProcessedSegment[] => {
    if (!body.trim()) return [];
    const segments = splitMdxSegments(body);
    const result: ProcessedSegment[] = [];
    let firstMdSeen = false;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (seg.type === 'jsx') {
        result.push({ type: 'jsx', componentName: seg.componentName, props: seg.props, key: i });
        continue;
      }
      const isFirstMd = !firstMdSeen;
      firstMdSeen = true;
      const { processed, refs } = extractInlineComponents(seg.text);
      const html = renderMd(processed, withoutFirstHeading && isFirstMd);
      if (!html.trim()) continue;
      if (refs.size === 0) {
        result.push({ type: 'md-plain', html, key: i });
      } else {
        result.push({ type: 'md-inline', html, refs, key: i });
      }
    }
    return result;
  }, [body, withoutFirstHeading]);

  if (!body.trim()) return null;

  return (
    <>
      {processedSegments.map(seg => {
        if (seg.type === 'jsx') {
          const Component = MDX_COMPONENTS[seg.componentName];
          if (!Component) return null;
          return <Component key={seg.key} {...validateProps(seg.props)} />;
        }
        if (seg.type === 'md-plain') {
          // eslint-disable-next-line react/no-danger
          return <div key={seg.key} dangerouslySetInnerHTML={{ __html: seg.html }} />;
        }
        return <InlineHtmlBlock key={seg.key} html={seg.html} refs={seg.refs} />;
      })}
    </>
  );
};
