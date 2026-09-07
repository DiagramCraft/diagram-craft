import { PlateElement, PlateLeaf, useEditorRef } from 'platejs/react';
import type { PlateElementProps, PlateLeafProps } from 'platejs/react';
import type { TElement } from 'platejs';
import { EditorBlock, isListParagraph, isTodoListParagraph } from './EditorBlock';
import styles from './PlateMarkdownEditor.module.css';

// ─── Block element components ───────────────────────────────────────────────

export const TodoListElement = ({ element, children, ...props }: PlateElementProps) => {
  const editor = useEditorRef();
  const checked = (element as TElement & { checked?: boolean }).checked ?? false;

  return (
    <EditorBlock as="div" element={element} {...props} className={styles.todoListItem}>
      <input
        type="checkbox"
        checked={checked}
        contentEditable={false}
        aria-label={checked ? 'Mark task incomplete' : 'Mark task complete'}
        onChange={event => {
          const path = editor.api.findPath(element);
          if (path) editor.tf.setNodes({ checked: event.target.checked }, { at: path });
        }}
        onClick={event => event.stopPropagation()}
      />
      <span className={styles.todoListContent}>{children}</span>
    </EditorBlock>
  );
};

export const PElement = (props: PlateElementProps) =>
  isTodoListParagraph(props.element) ? (
    <TodoListElement {...props} />
  ) : (
    <EditorBlock as={isListParagraph(props.element) ? 'div' : 'p'} {...props} />
  );

export const H1Element = (props: PlateElementProps) => <EditorBlock as="h1" {...props} />;
export const H2Element = (props: PlateElementProps) => <EditorBlock as="h2" {...props} />;
export const H3Element = (props: PlateElementProps) => <EditorBlock as="h3" {...props} />;
export const BlockquoteElement = (props: PlateElementProps) => (
  <EditorBlock as="blockquote" {...props} />
);
export const CodeBlockElement = (props: PlateElementProps) => <EditorBlock as="pre" {...props} />;
export const CodeLineElement = (props: PlateElementProps) => <PlateElement as="code" {...props} />;

export const ListElement = ({ element, ...props }: PlateElementProps) => {
  const as =
    (element as TElement & { listStyleType?: string }).listStyleType === 'decimal'
      ? ('ol' as const)
      : ('ul' as const);
  return <EditorBlock as={as} element={element} {...props} />;
};

export const ListItemElement = (props: PlateElementProps) => <PlateElement as="li" {...props} />;
export const ListItemContentElement = (props: PlateElementProps) => <PlateElement {...props} />;

export const LinkElement = ({ element, children, ...props }: PlateElementProps) => {
  const url = (element as TElement & { url?: string }).url;
  return (
    <PlateElement as="span" element={element} {...props}>
      <a href={url}>{children}</a>
    </PlateElement>
  );
};

export const HrElement = ({ children, ...props }: PlateElementProps) => (
  <EditorBlock {...props}>
    <hr contentEditable={false} />
    {children}
  </EditorBlock>
);

// ─── Leaf (mark) components ────────────────────────────────────────────────

export const BoldLeaf = (props: PlateLeafProps) => <PlateLeaf as="strong" {...props} />;
export const ItalicLeaf = (props: PlateLeafProps) => <PlateLeaf as="em" {...props} />;
export const InlineCodeLeaf = (props: PlateLeafProps) => <PlateLeaf as="code" {...props} />;
export const StrikethroughLeaf = (props: PlateLeafProps) => <PlateLeaf as="s" {...props} />;
