import type React from 'react';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { TbId, TbHash } from 'react-icons/tb';
import { EntityCard } from './editor/blocks/entity-card/EntityCard';
import { EntityCardEditable, entityCardMdxRule } from './editor/blocks/entity-card/EntityCardEditable';
import { EntityField } from './editor/inlines/entity-field/EntityField';
import { EntityFieldEditable, entityFieldMdxRule } from './editor/inlines/entity-field/EntityFieldEditable';

// ─── Types ───────────────────────────────────────────────────────────────────

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
    isVoid: true;
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
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: EditorSpec;
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const MDX_COMPONENTS = {
  EntityCard: {
    component: EntityCard as unknown as React.ComponentType<Record<string, string>>,
    mode: 'block',
    allowedProps: ['id', 'fields'],
    editorSpec: {
      editableComponent: EntityCardEditable as unknown as React.ComponentType<Record<string, unknown>>,
      nodeOptions: { isVoid: true },
      mdxRule: entityCardMdxRule,
      slashCommand: {
        key: 'entity-card',
        label: 'Entity Card',
        description: 'Embed entity metadata inline',
        icon: <TbId size={14} />,
        keywords: ['entity', 'card', 'catalog', 'service'],
        onSelect: (editor, { insertOrReplaceBlock }) => {
          insertOrReplaceBlock(editor, {
            type: 'EntityCard',
            entityId: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  },
  EntityField: {
    component: EntityField as unknown as React.ComponentType<Record<string, string>>,
    mode: 'inline',
    allowedProps: ['id', 'field'],
    editorSpec: {
      editableComponent: EntityFieldEditable as unknown as React.ComponentType<Record<string, unknown>>,
      nodeOptions: { isVoid: true, isInline: true },
      mdxRule: entityFieldMdxRule,
      slashCommand: {
        key: 'entity-field',
        label: 'Field Embed',
        description: 'Embed a live entity field value',
        icon: <TbHash size={14} />,
        keywords: ['field', 'entity', 'value', 'embed', 'inline'],
        onSelect: editor => {
          editor.tf.insertNodes({
            type: 'EntityField',
            entityId: '',
            field: '',
            children: [{ text: '' }]
          });
        }
      }
    }
  }
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;
