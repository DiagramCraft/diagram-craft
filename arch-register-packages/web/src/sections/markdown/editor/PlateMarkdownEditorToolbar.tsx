import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  getDOMSelectionBoundingClientRect,
  flip,
  offset,
  useFloatingToolbar,
  useFloatingToolbarState
} from '@platejs/floating';
import { useEditorId, useEditorRef, useEventEditorValue } from 'platejs/react';
import { Toolbar } from '@diagram-craft/app-components/src/Toolbar';
import { TbFileText } from 'react-icons/tb';
import { WIKI_LINK_TYPE } from '../../../widgets/content-layout/wiki-link/WikiLinkEditable';
import { insertOrReplaceInline } from './PlateMarkdownEditorSlashCommands';
import styles from './PlateMarkdownEditor.module.css';

const MarkButton = ({
  mark,
  label,
  children
}: {
  mark: string;
  label: string;
  children: ReactNode;
}) => {
  const editor = useEditorRef();
  const isActive = !!(editor.api.marks() as Record<string, unknown> | null)?.[mark];

  return (
    <Toolbar.Button
      type="button"
      data-pressed={isActive ? true : undefined}
      title={label}
      onMouseDown={event => {
        event.preventDefault();
        editor.tf.toggleMark(mark);
      }}
    >
      {children}
    </Toolbar.Button>
  );
};

const HeadingButton = ({ type, label }: { type: string; label: string }) => {
  const editor = useEditorRef();
  return (
    <Toolbar.Button
      type="button"
      title={label}
      onMouseDown={event => {
        event.preventDefault();
        editor.tf.setNodes({ type });
      }}
    >
      {type.toUpperCase()}
    </Toolbar.Button>
  );
};

const WikiLinkButton = () => {
  const editor = useEditorRef();
  return (
    <Toolbar.Button
      type="button"
      title="Link to wiki page"
      onMouseDown={event => {
        event.preventDefault();
        editor.tf.collapse({ edge: 'end' });
        insertOrReplaceInline(editor, {
          type: WIKI_LINK_TYPE,
          nodeId: '',
          children: [{ text: '' }]
        });
      }}
    >
      <TbFileText size={14} />
    </Toolbar.Button>
  );
};

export const FloatingToolbar = () => {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue('focus');
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.querySelector('.ar-app'));
  }, []);

  const state = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    floatingOptions: {
      strategy: 'fixed',
      placement: 'top',
      middleware: [offset(8), flip({ padding: 8 })],
      getBoundingClientRect: getDOMSelectionBoundingClientRect
    }
  });

  const { hidden, props: toolbarProps, ref } = useFloatingToolbar(state);

  if (hidden) return null;

  const toolbar = (
    <div
      ref={ref}
      {...toolbarProps}
      className={styles.floatingToolbar}
      onMouseDown={event => event.preventDefault()}
    >
      <Toolbar.Root>
        <MarkButton mark="bold" label="Bold">
          <strong>B</strong>
        </MarkButton>
        <MarkButton mark="italic" label="Italic">
          <em>I</em>
        </MarkButton>
        <MarkButton mark="code" label="Inline code">
          <code>`</code>
        </MarkButton>
        <MarkButton mark="strikethrough" label="Strikethrough">
          <s>S</s>
        </MarkButton>
        <Toolbar.Separator />
        <HeadingButton type="h1" label="Heading 1" />
        <HeadingButton type="h2" label="Heading 2" />
        <HeadingButton type="h3" label="Heading 3" />
        <Toolbar.Separator />
        <WikiLinkButton />
      </Toolbar.Root>
    </div>
  );

  return portalContainer ? createPortal(toolbar, portalContainer) : toolbar;
};
