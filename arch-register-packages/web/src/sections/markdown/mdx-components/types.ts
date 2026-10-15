import type React from 'react';
import type { z } from 'zod';
import type { PlateElementProps, useEditorRef } from 'platejs/react';
import type {
  DeserializeMdOptions,
  SerializeMdOptions,
  MdDecoration,
  MdMdxJsxFlowElement,
  MdMdxJsxTextElement
} from '@platejs/markdown';
import type { TElement } from 'platejs';
import type { WidgetCategory } from './widgetCategories';

export type ComponentIcon = React.ComponentType<{ size?: number }>;

export type MdxMode = 'block' | 'inline';

type MdxAstNode<Mode extends MdxMode> = Mode extends 'block'
  ? MdMdxJsxFlowElement
  : MdMdxJsxTextElement;

export type MdxRuleDef<E extends TElement, Mode extends MdxMode> = {
  deserialize: (
    mdastNode: MdxAstNode<Mode>,
    deco: MdDecoration,
    options: DeserializeMdOptions
  ) => E;
  serialize: (slateNode: E, options: SerializeMdOptions) => MdxAstNode<Mode>;
};

/**
 * Slash menu entry. Its label, description and keywords come from the owning component's `name`,
 * `description` and `keywords`.
 */
export type SlashCommandDef<E extends TElement = TElement> = {
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: {
      insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
      insertOrReplaceInline: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
    }
  ) => void;
};

/** Rich-editor registration of an MDX component. */
export type EditorSpec<E extends TElement = TElement, Mode extends MdxMode = MdxMode> = {
  /** The Plate element component used in the editor */
  editableComponent: React.FC<PlateElementProps<E>>;
  /** Plate plugin node options */
  nodeOptions: {
    isVoid?: true;
    isInline?: true;
  };
  mdxRule: MdxRuleDef<E, Mode>;
  /**
   * Only meaningful when the owning spec has acceptsChildren: true. Builds a
   * wrapper node around an existing node being promoted into it (used by the
   * block context menu's "Wrap with" action).
   */
  createWrapper?: (child: TElement) => E;
  /** Slash command registration; omit to hide from the slash menu */
  slashCommand?: SlashCommandDef<E>;
};

export type WidgetSurface = 'workspace' | 'project';

export type DashboardWidgetSpec<Config extends Record<string, unknown> = Record<string, unknown>> =
  {
    defaultW: number;
    defaultH: number;
    /** Which dashboard surfaces this widget may be added to. */
    surfaces: ReadonlyArray<WidgetSurface>;
    /** Optional live title renderer for widgets whose title comes from fetched data. */
    titleComponent?: React.ComponentType<{ config: Config }>;
    /** Extra content (links, counts) at the right of the frame header, before the edit/remove controls. */
    headerActionsComponent?: React.ComponentType<{ config: Config }>;
    frame?: {
      /**
       * No border, background or header unless the dashboard is being edited. A function decides
       * per widget instance from its config.
       */
      hideOutsideEdit?: boolean | ((config: Config) => boolean);
      /** Whether the frame body has padding; defaults to true. */
      padded?: boolean;
      /** Whether the component icon is shown in the frame header; defaults to true. */
      showIcon?: boolean;
    };
    /** Per-instance title; falls back to the component's `name` when omitted. */
    getTitle?: (config: Config) => string;
  };

/** The dialog hosting a component's config form, in the wiki editor and on a dashboard. */
export type ConfigDialogSpec = {
  /** Width override; defaults to 460. */
  width?: number | string;
  /** `large` makes the dialog fill ~90% of the viewport (overrides `width`). */
  size?: 'large';
};

/** Context handed to a component's config form by whichever surface is editing it. */
export type ConfigFormContext = {
  mode: 'mdx' | 'dashboard';
  surface: WidgetSurface;
};

/** Props of a shared config form, typed by the component's config. */
export type ConfigFormProps<Config extends Record<string, unknown>> = {
  config: Config;
  onChange: (config: Config) => void;
  context: ConfigFormContext;
};

/** How a component is authored in, parsed from and rendered for wiki MDX content. */
export type MdxSpec<E extends TElement = TElement, Mode extends MdxMode = MdxMode> = {
  mode: Mode;
  /** The authored MDX attribute names that reach the shared component. */
  allowedProps: ReadonlyArray<string>;
  /**
   * Converts authored MDX string attributes to the shared component's props. `defaultConfig` is
   * the component's starting config, for filling in whatever the attributes leave out.
   */
  mapProps?: (
    props: Record<string, string>,
    defaultConfig: Record<string, unknown>
  ) => Record<string, unknown>;
  /**
   * Marks a block-level component as a wrapper that accepts exactly one other
   * block-level (non-wrapper) MDX component as its child, e.g. Caption. Depth is
   * capped at 1 — a wrapper cannot be nested inside another wrapper.
   */
  acceptsChildren?: boolean;
  /**
   * Marks a block-level component as accepting arbitrary rich markdown content
   * (paragraphs, lists, etc.) between its open/close tags, e.g. Callout.
   * Distinct from `acceptsChildren`'s single-MDX-component wrapper semantics.
   */
  acceptsRichContent?: boolean;
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: EditorSpec<E, Mode>;
};

/**
 * An `MdxSpec` that depends on the owning component's `type` (the JSX element name), which
 * `defineWidget` supplies.
 */
export type MdxSpecFactory = (type: string) => MdxSpec;

/** What a new instance's starting config may depend on. */
export type DefaultConfigContext = {
  /** The saved view a dashboard widget is being created from. */
  viewId?: string;
  projectId?: string;
  workspaceSlug?: string;
};

/** A zod object schema describing a component's config. */
export type ConfigSchema = z.ZodType<Record<string, unknown>>;

/**
 * A component, shared by the wiki and dashboard catalogs. The generics type what an author writes
 * (the config, Slate element and MDX mode); the registry stores the erased default instantiation.
 */
export type WidgetDefinition<
  Config extends Record<string, unknown> = Record<string, unknown>,
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode
> = {
  /** Stable identity: the MDX element name and the `type` of persisted dashboard widgets. */
  type: string;
  /** Display name and description shown in every catalog. */
  name: string;
  description: string;
  /** Extra search terms for the slash menu, beyond the name and description. */
  keywords?: string[];
  category: WidgetCategory;
  /** Shared icon for all surfaces that expose this component. */
  icon?: ComponentIcon;
  /** Shared renderer used by every surface that exposes this component. */
  // biome-ignore lint/suspicious/noExplicitAny: component props are typed by each surface adapter
  component: React.ComponentType<any>;
  /**
   * Describes this component's config, including its starting values (`withInitial`). Also decides
   * whether a stored or edited config is valid, so it should reject configs missing required
   * selections (e.g. an empty entity id), not just wrong types: the same rule gates both loading a
   * dashboard widget and the dialogs' Save.
   */
  configSchema?: ConfigSchema;
  /**
   * Starting config values that depend on the creation context, which a schema can't declare.
   * Use `createDefaultConfig` to get the complete starting config.
   */
  defaultConfig?: (context: DefaultConfigContext) => Record<string, unknown>;
  /** Size of the dialog hosting `configForm`. */
  configDialog?: ConfigDialogSpec;
  /** Shared configuration form used by every surface that exposes this component. */
  // biome-ignore lint/suspicious/noExplicitAny: config types are erased in the shared registry
  configForm?: React.ComponentType<any>;
  /** Present for components that can be authored in wiki content. */
  mdx?: MdxSpec<E, Mode>;
  /** Present for components that can be added to a dashboard; requires `configSchema`. */
  dashboard?: DashboardWidgetSpec<Config>;
};

export type MdxWidgetDefinition = WidgetDefinition & { mdx: MdxSpec };

export type DashboardWidgetWidgetDefinition = WidgetDefinition & {
  icon: ComponentIcon;
  dashboard: DashboardWidgetSpec;
  configSchema: ConfigSchema;
};
