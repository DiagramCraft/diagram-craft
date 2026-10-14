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
import type { ComponentCategory } from './componentCategories';

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

export type SlashCommandDef<E extends TElement = TElement> = {
  label: string;
  description: string;
  keywords?: string[];
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: {
      insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
      insertOrReplaceInline: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
    }
  ) => void;
};

/** Label and description come from the owning registration's name and description. */
export type SlashCommandRegistrationDef<E extends TElement = TElement> = Omit<
  SlashCommandDef<E>,
  'label' | 'description'
>;

type EditorSpecBase<E extends TElement, Mode extends MdxMode> = {
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
};

/** Editor registration as authored; the slash command lacks label and description. */
export type MdxEditorSpecDef<
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode
> = EditorSpecBase<E, Mode> & {
  /** Slash command registration; omit to hide from the slash menu */
  slashCommand?: SlashCommandRegistrationDef<E>;
};

/** Editor registration as stored in the registry, with the slash command completed. */
export type EditorSpec<
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode
> = EditorSpecBase<E, Mode> & {
  slashCommand?: SlashCommandDef<E>;
};

export type WidgetSurface = 'workspace' | 'project';

export type DashboardWidgetSpec<Config extends Record<string, unknown> = Record<string, unknown>> =
  {
    label: string;
    description: string;
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
    /** Per-instance title; falls back to `label` when omitted. */
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

type MdxComponentSpecBase<Mode extends MdxMode> = {
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
};

/** MDX registration as authored on a component. */
export type MdxComponentRegistrationDef<
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode
> = MdxComponentSpecBase<Mode> & {
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: MdxEditorSpecDef<E, Mode>;
};

/**
 * MDX registration as stored in the registry. The element type is erased (`any`) because the
 * registry holds components with different Slate elements.
 */
export type MdxComponentSpec = MdxComponentSpecBase<MdxMode> & {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  editorSpec?: EditorSpec<any, MdxMode>;
};

/** What a new instance's starting config may depend on. */
export type DefaultConfigContext = {
  /** The saved view a dashboard widget is being created from. */
  viewId?: string;
  projectId?: string;
  workspaceSlug?: string;
};

/** A zod object schema describing a component's config. */
export type ConfigSchema = z.ZodType<Record<string, unknown>>;

/** A complete registration shared by the wiki and dashboard catalogs. */
export type ComponentDefinition = {
  type: string;
  name: string;
  description: string;
  category: ComponentCategory;
  /** Shared icon for all surfaces that expose this component. */
  icon?: ComponentIcon;
  /** Shared renderer used by every surface that exposes this component. */
  // biome-ignore lint/suspicious/noExplicitAny: component props are typed by each surface adapter
  component: React.ComponentType<any>;
  /** Creates the starting config of a new instance. */
  createDefaultConfig?: (context: DefaultConfigContext) => Record<string, unknown>;
  /**
   * Describes this component's config. Also decides whether a stored or edited config is valid,
   * so it should reject configs missing required selections (e.g. an empty entity id), not just
   * wrong types: the same rule gates both loading a dashboard widget and the dialogs' Save.
   */
  configSchema?: ConfigSchema;
  /** Size of the dialog hosting `configForm`. */
  configDialog?: ConfigDialogSpec;
  /** Shared configuration form used by every surface that exposes this component. */
  // biome-ignore lint/suspicious/noExplicitAny: config types are erased in the shared registry
  configForm?: React.ComponentType<any>;
  /** Present for components rendered through the MDX preview pipeline. */
  mdx?: MdxComponentSpec;
  /** Present for components that can be added to a dashboard. */
  // biome-ignore lint/suspicious/noExplicitAny: dashboard config types are erased in the shared catalog
  dashboardWidget?: DashboardWidgetSpec<any>;
};

export type MdxComponentDefinition = ComponentDefinition & { mdx: MdxComponentSpec };

export type DashboardWidgetComponentDefinition = ComponentDefinition & {
  icon: ComponentIcon;
  dashboardWidget: DashboardWidgetSpec;
  configSchema: ConfigSchema;
  createDefaultConfig: (context: DefaultConfigContext) => Record<string, unknown>;
};
