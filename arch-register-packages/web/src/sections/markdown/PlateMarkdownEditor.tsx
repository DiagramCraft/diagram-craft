import { useCallback, useEffect, useRef } from 'react';
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  createPlatePlugin,
  usePlateEditor,
  type PlateElementProps,
  type PlateLeafProps
} from 'platejs/react';
import { MarkdownPlugin, deserializeMd, serializeMd } from '@platejs/markdown';
import type { TElement, Value } from 'platejs';
import styles from './PlateMarkdownEditor.module.css';

// ─── Element components ────────────────────────────────────────────────────

const PElement = (props: PlateElementProps) => (
  <PlateElement as="p" {...props} />
);

const H1Element = (props: PlateElementProps) => (
  <PlateElement as="h1" {...props} />
);

const H2Element = (props: PlateElementProps) => (
  <PlateElement as="h2" {...props} />
);

const H3Element = (props: PlateElementProps) => (
  <PlateElement as="h3" {...props} />
);

const BlockquoteElement = (props: PlateElementProps) => (
  <PlateElement as="blockquote" {...props} />
);

const CodeBlockElement = (props: PlateElementProps) => (
  <PlateElement as="pre" {...props} />
);

const CodeLineElement = (props: PlateElementProps) => (
  <PlateElement as="code" {...props} />
);

const ListElement = ({ element, ...props }: PlateElementProps) => {
  const as = (element as TElement & { listStyleType?: string }).listStyleType === 'decimal' ? 'ol' : 'ul';
  return <PlateElement as={as} element={element} {...props} />;
};

const ListItemElement = (props: PlateElementProps) => (
  <PlateElement as="li" {...props} />
);

const ListItemContentElement = (props: PlateElementProps) => (
  // lic (list item content) renders inline, no wrapping tag
  <PlateElement {...props} />
);

const LinkElement = ({ element, children, ...props }: PlateElementProps) => {
  const url = (element as TElement & { url?: string }).url;
  return (
    <PlateElement element={element} {...props}>
      <a href={url}>{children}</a>
    </PlateElement>
  );
};

const HrElement = ({ children, ...props }: PlateElementProps) => (
  <PlateElement {...props}>
    {/* eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role */}
    <hr contentEditable={false} />
    {children}
  </PlateElement>
);

// ─── Leaf (mark) components ────────────────────────────────────────────────

const BoldLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="strong" {...props} />
);

const ItalicLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="em" {...props} />
);

const InlineCodeLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="code" {...props} />
);

const StrikethroughLeaf = (props: PlateLeafProps) => (
  <PlateLeaf as="s" {...props} />
);

// ─── Plugin definitions ────────────────────────────────────────────────────

const editorPlugins = [
  MarkdownPlugin,
  createPlatePlugin({ key: 'p', node: { isElement: true } }).withComponent(PElement),
  createPlatePlugin({ key: 'h1', node: { isElement: true } }).withComponent(H1Element),
  createPlatePlugin({ key: 'h2', node: { isElement: true } }).withComponent(H2Element),
  createPlatePlugin({ key: 'h3', node: { isElement: true } }).withComponent(H3Element),
  createPlatePlugin({ key: 'blockquote', node: { isElement: true } }).withComponent(BlockquoteElement),
  createPlatePlugin({ key: 'code_block', node: { isElement: true } }).withComponent(CodeBlockElement),
  createPlatePlugin({ key: 'code_line', node: { isElement: true } }).withComponent(CodeLineElement),
  createPlatePlugin({ key: 'list', node: { isElement: true } }).withComponent(ListElement),
  createPlatePlugin({ key: 'li', node: { isElement: true } }).withComponent(ListItemElement),
  createPlatePlugin({ key: 'lic', node: { isElement: true } }).withComponent(ListItemContentElement),
  createPlatePlugin({ key: 'a', node: { isElement: true, isInline: true } }).withComponent(LinkElement),
  createPlatePlugin({ key: 'hr', node: { isElement: true, isVoid: true } }).withComponent(HrElement),
  createPlatePlugin({ key: 'bold', node: { isLeaf: true } }).withComponent(BoldLeaf),
  createPlatePlugin({ key: 'italic', node: { isLeaf: true } }).withComponent(ItalicLeaf),
  createPlatePlugin({ key: 'code', node: { isLeaf: true } }).withComponent(InlineCodeLeaf),
  createPlatePlugin({ key: 'strikethrough', node: { isLeaf: true } }).withComponent(StrikethroughLeaf),
];

// ─── Component ─────────────────────────────────────────────────────────────

interface PlateMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

export const PlateMarkdownEditor = ({ value, onChange }: PlateMarkdownEditorProps) => {
  const externalValueRef = useRef(value);

  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: ed => deserializeMd(ed, value),
  });

  // Sync when an external change comes in (e.g. restore from revision history)
  useEffect(() => {
    if (value === externalValueRef.current) return;
    externalValueRef.current = value;
    editor.tf.setValue(deserializeMd(editor, value));
  }, [value, editor]);

  const handleChange = useCallback(
    ({ value: _editorValue }: { value: Value; editor: typeof editor }) => {
      const md = serializeMd(editor);
      externalValueRef.current = md;
      onChange(md);
    },
    [editor, onChange]
  );

  return (
    <div className={styles.editor}>
      <Plate editor={editor} onChange={handleChange}>
        <PlateContent
          className={styles.plateContent}
          placeholder="Start writing…"
          spellCheck
        />
      </Plate>
    </div>
  );
};
