import type React from 'react';
import type { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import type { ComponentCategory } from './componentCategories';

export type ComponentSurface = 'wiki' | 'dashboard';

export type SlashCommandDef = {
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: {
      insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void;
      insertOrReplaceInline: (editor: ReturnType<typeof useEditorRef>, node: TElement) => void;
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
  /**
   * Only meaningful when the owning spec has acceptsChildren: true. Builds a
   * wrapper node around an existing node being promoted into it (used by the
   * block context menu's "Wrap with" action).
   */
  createWrapper?: (child: TElement) => TElement;
};

export type WidgetSurface = 'workspace' | 'project';

export type DashboardWidgetSpec<Config extends Record<string, unknown> = Record<string, unknown>> =
  {
    /** Icon shown in the widget picker and the widget frame header. */
    icon: React.ComponentType<{ size?: number }>;
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
      /** Whether the widget's icon is shown in the frame header; defaults to true. The picker always shows it. */
      showIcon?: boolean;
    };
    /**
     * Structural validity AND save-completeness: also gates the dialog's Save
     * button, so this should reject configs missing required selections (e.g. an
     * empty entity id), not just wrong types.
     */
    isValidConfig: (config: Record<string, unknown>) => config is Config;
    /** Per-instance title; falls back to `label` when omitted. */
    getTitle?: (config: Config) => string;
    /** WidgetConfigDialog width override; defaults to 460. */
    dialogWidth?: number | string;
    /** `large` makes WidgetConfigDialog fill ~90% of the viewport (overrides dialogWidth). */
    dialogSize?: 'large';
  };

/** Dashboard registration input before the shared component/form are hoisted. */
export type DashboardWidgetRegistrationSpec<
  Config extends Record<string, unknown> = Record<string, unknown>
> = DashboardWidgetSpec<Config> & {
  component?: React.ComponentType<{ config: Config }>;
  createDefaultProps: (context: { viewId?: string }) => { config: Config };
  configForm?: React.ComponentType<{
    config: Config;
    onChange: (config: Config) => void;
    context: {
      mode: 'mdx' | 'dashboard';
      workspaceSlug: string;
      projectId?: string;
      surface: WidgetSurface;
    };
  }>;
};

export type MdxComponentSpec = {
  mode: 'block' | 'inline';
  allowedProps: ReadonlyArray<string>;
  /** Adapts authored string attributes to the component's props using component defaults. */
  mapProps?: (
    props: Record<string, string>,
    defaultProps: Record<string, unknown>
  ) => Record<string, unknown>;
  /** Normalizes string props before they are exposed to the preview renderer. */
  normalizeProps?: (props: Record<string, string>) => Record<string, string>;
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
  editorSpec?: EditorSpec;
};

/** A complete registration shared by the wiki and dashboard catalogs. */
export type ComponentDefinition = {
  type: string;
  name: string;
  description: string;
  category: ComponentCategory;
  surfaces: ReadonlyArray<ComponentSurface>;
  /** Shared renderer used by every surface that exposes this component. */
  // biome-ignore lint/suspicious/noExplicitAny: component props are typed by each surface adapter
  component: React.ComponentType<any>;
  /** Creates fresh default props for the shared renderer. */
  createDefaultProps?: (context: { viewId?: string }) => Record<string, unknown>;
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
  dashboardWidget: DashboardWidgetSpec;
  createDefaultProps: (context: { viewId?: string }) => { config: Record<string, unknown> };
};
