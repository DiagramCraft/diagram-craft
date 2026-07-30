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
    /**
     * Renders the widget body from persisted config. Distinct from the MDX
     * `component` field, which takes flat string props authored in wiki markdown.
     */
    component: React.ComponentType<{ config: Config }>;
    /** Optional live title renderer for widgets whose title comes from fetched data. */
    titleComponent?: React.ComponentType<{ config: Config }>;
    /**
     * Structural validity AND save-completeness: also gates the dialog's Save
     * button, so this should reject configs missing required selections (e.g. an
     * empty entity id), not just wrong types.
     */
    isValidConfig: (config: Record<string, unknown>) => config is Config;
    createDefaultConfig: (context: { viewId?: string }) => Config;
    /** Per-instance title; falls back to `label` when omitted. */
    getTitle?: (config: Config) => string;
    /**
     * Renders this widget's config editor in the dashboard's WidgetConfigDialog.
     * Omit for widgets with no configurable options.
     */
    configForm?: React.ComponentType<{
      config: Config;
      onChange: (config: Config) => void;
      context: { workspaceSlug: string; projectId?: string; surface: WidgetSurface };
    }>;
    /** WidgetConfigDialog width override; defaults to 460. */
    dialogWidth?: number | string;
  };

export type MdxComponentSpec = {
  /** Preview-mode React component */
  component: React.ComponentType<Record<string, string>>;
  mode: 'block' | 'inline';
  allowedProps: ReadonlyArray<string>;
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
  /** Surfaces this component may render on; `undefined` means wiki only (default, matches all prior behavior). */
  surfaces?: ReadonlyArray<'wiki' | 'dashboard'>;
  /** Present when this component can also be added as a dashboard widget. */
  // biome-ignore lint/suspicious/noExplicitAny: registry entries have per-component Config types, erased here
  dashboardWidget?: DashboardWidgetSpec<any>;
};
