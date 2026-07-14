import type React from 'react';
import type { TElement } from 'platejs';
import { type PlateElementProps, type useEditorRef } from 'platejs/react';
import type {
  DeserializeMdOptions,
  SerializeMdOptions,
  MdDecoration,
  MdMdxJsxFlowElement,
  MdMdxJsxTextElement
} from '@platejs/markdown';
import type { MdxComponentSpec } from './types';

export type MdxMode = 'block' | 'inline';

type MdxAstNode<Mode extends MdxMode> = Mode extends 'block'
  ? MdMdxJsxFlowElement
  : MdMdxJsxTextElement;

/**
 * Keys of a preview component's own props that may be exposed as external MDX
 * attribute names. Deliberately independent of the Slate element's field names
 * (e.g. ImageEmbed's preview prop is `id`, its Slate field is `fileId`).
 */
export type AllowedPropKey<P> = Exclude<Extract<keyof P, string>, 'children'>;

export type MdxRuleDef<E extends TElement, Mode extends MdxMode> = {
  deserialize: (
    mdastNode: MdxAstNode<Mode>,
    deco: MdDecoration,
    options: DeserializeMdOptions
  ) => E;
  serialize: (slateNode: E, options: SerializeMdOptions) => MdxAstNode<Mode>;
};

export type SlashCommandDef<E extends TElement = TElement> = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: { insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: E) => void }
  ) => void;
};

export type MdxEditorSpecDef<E extends TElement, Mode extends MdxMode> = {
  /** The Plate element component used in the editor */
  editableComponent: React.ComponentType<PlateElementProps<E>>;
  /** Plate plugin node options */
  nodeOptions: {
    isVoid?: true;
    isInline?: true;
  };
  mdxRule: MdxRuleDef<E, Mode>;
  /** Slash command registration; omit to hide from the slash menu */
  slashCommand?: SlashCommandDef<E>;
  /**
   * Only meaningful when the owning spec has acceptsChildren: true. Builds a
   * wrapper node around an existing node being promoted into it (used by the
   * block context menu's "Wrap with" action).
   */
  createWrapper?: (child: TElement) => E;
};

export type MdxComponentDef<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
> = {
  /** Preview-mode React component */
  component: React.ComponentType<P>;
  mode: Mode;
  allowedProps: ReadonlyArray<AllowedPropKey<P>>;
  /** Normalizes string props parsed from authored MDX. */
  normalizeProps?: (props: Record<string, string>) => Record<string, string>;
  /**
   * Marks a block-level component as a wrapper that accepts exactly one other
   * block-level (non-wrapper) MDX component as its child, e.g. Caption. Depth is
   * capped at 1 — a wrapper cannot be nested inside another wrapper.
   */
  acceptsChildren?: boolean;
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: MdxEditorSpecDef<E, Mode>;
};

/**
 * Declares one MDX component's registration with its Slate element shape (E),
 * preview component props (P), and mode checked against each other at compile
 * time — `allowedProps` against `keyof P`, `mdxRule`/`editableComponent`
 * against `E`. Returns the existing, deliberately loose `MdxComponentSpec` so
 * the registry (mdxRegistry.tsx) and its consumers keep working against a
 * homogeneous map; the cast below is the single, intentional erasure boundary
 * that replaces the per-registration `as unknown as` casts this helper removes.
 */
export function defineMdxComponent<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
>(def: MdxComponentDef<E, P, Mode>): MdxComponentSpec {
  return def as unknown as MdxComponentSpec;
}
