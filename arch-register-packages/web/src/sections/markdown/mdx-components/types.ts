import type React from 'react';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';

export type SlashCommandDef = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: {
      insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void;
    }
  ) => void;
};

export type EditorSpec = {
  /** The Plate element component used in the editor */
  editableComponent: React.ComponentType<Record<string, unknown>>;
  /** Plate plugin node options */
  nodeOptions: {
    isVoid?: true;
    isInline?: true;
  };
  // biome-ignore lint/suspicious/noExplicitAny: MDX plugin API requires flexible typing
  mdxRule: Record<string, any>;
  /** Slash command registration; omit to hide from the slash menu */
  slashCommand?: SlashCommandDef;
};

export type MdxComponentSpec = {
  /** Preview-mode React component */
  component: React.ComponentType<Record<string, string>>;
  mode: 'block' | 'inline';
  allowedProps: ReadonlyArray<string>;
  /**
   * Marks a block-level component as a wrapper that accepts exactly one other
   * block-level (non-wrapper) MDX component as its child, e.g. Caption. Depth is
   * capped at 1 — a wrapper cannot be nested inside another wrapper.
   */
  acceptsChildren?: boolean;
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: EditorSpec;
};
