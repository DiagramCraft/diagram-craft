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
import type {
  ComponentDefinition,
  ComponentSurface,
  DashboardWidgetSpec,
  MdxComponentSpec
} from './types';
import type { ComponentCategory } from './componentCategories';

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
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: (
    editor: ReturnType<typeof useEditorRef>,
    helpers: {
      insertOrReplaceBlock: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
      insertOrReplaceInline: (editor: ReturnType<typeof useEditorRef>, node: E) => void;
    }
  ) => void;
};

type SlashCommandRegistrationDef<E extends TElement> = Omit<
  SlashCommandDef<E>,
  'label' | 'description'
> &
  Partial<Pick<SlashCommandDef<E>, 'label' | 'description'>>;

type DashboardWidgetRegistrationDef<Config extends Record<string, unknown>> = Omit<
  DashboardWidgetSpec<Config>,
  'label' | 'description'
> &
  Partial<Pick<DashboardWidgetSpec<Config>, 'label' | 'description'>>;

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
  slashCommand?: SlashCommandRegistrationDef<E>;
  /**
   * Only meaningful when the owning spec has acceptsChildren: true. Builds a
   * wrapper node around an existing node being promoted into it (used by the
   * block context menu's "Wrap with" action).
   */
  createWrapper?: (child: TElement) => E;
};

export type MdxSurface = ComponentSurface;

export type MdxComponentDef<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
> = {
  /** Stable key used by MDX and persisted dashboard widget instances. */
  type: string;
  /** Shared category shown in the wiki and dashboard catalogs. */
  category: ComponentCategory;
  /** Shared display name and description for dashboard and slash command catalogs. */
  label?: string;
  description?: string;
  /** Content surfaces where the component may be rendered. */
  surfaces: ReadonlyArray<ComponentSurface>;
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
  /**
   * Marks a block-level component as accepting arbitrary rich markdown content
   * (paragraphs, lists, etc.) between its open/close tags, e.g. Callout.
   * Distinct from `acceptsChildren`'s single-MDX-component wrapper semantics.
   */
  acceptsRichContent?: boolean;
  /** Editor-mode registration; present for all components that support rich editing */
  editorSpec?: MdxEditorSpecDef<E, Mode>;
  /** Present when this component can also be added as a dashboard widget. */
  // biome-ignore lint/suspicious/noExplicitAny: registrations erase per-widget config types here
  dashboardWidget?: DashboardWidgetRegistrationDef<any>;
};

export type DashboardOnlyComponentDef = {
  type: string;
  category: ComponentCategory;
  surfaces: ReadonlyArray<'dashboard'>;
  // biome-ignore lint/suspicious/noExplicitAny: dashboard config types are erased in the shared catalog
  dashboardWidget: DashboardWidgetSpec<any>;
};

/**
 * Declares one component registration with shared identity, category and
 * surfaces. MDX-specific editor and serialization details and dashboard widget
 * details are optional, allowing dashboard-only components to use the same
 * catalog without pretending to be editable MDX nodes.
 */
export function defineComponent<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
>(def: MdxComponentDef<E, P, Mode>): ComponentDefinition;
export function defineComponent(def: DashboardOnlyComponentDef): ComponentDefinition;
export function defineComponent(
  def: MdxComponentDef<TElement, Record<string, unknown>, MdxMode> | DashboardOnlyComponentDef
): ComponentDefinition {
  const { type, category, surfaces, dashboardWidget, ...mdx } = def;
  const label = 'label' in def ? def.label : undefined;
  const description = 'description' in def ? def.description : undefined;
  const mdxSpec = 'component' in mdx ? (mdx as unknown as MdxComponentSpec) : undefined;
  const slashCommand = mdxSpec?.editorSpec?.slashCommand;
  const resolveMetadata = (
    field: 'label' | 'description',
    ...values: Array<string | undefined>
  ) => {
    const value = values.find(candidate => candidate !== undefined);
    if (value === undefined) {
      throw new Error(`Component ${type} is missing ${field} metadata`);
    }
    return value;
  };

  const normalizedDashboardWidget = dashboardWidget
    ? {
        ...dashboardWidget,
        label: resolveMetadata('label', label, dashboardWidget.label, slashCommand?.label),
        description: resolveMetadata(
          'description',
          description,
          dashboardWidget.description,
          slashCommand?.description
        )
      }
    : undefined;
  const normalizedSlashCommand = slashCommand
    ? {
        ...slashCommand,
        label: resolveMetadata('label', label, slashCommand.label, dashboardWidget?.label),
        description: resolveMetadata(
          'description',
          description,
          slashCommand.description,
          dashboardWidget?.description
        )
      }
    : undefined;

  const normalizedMdxSpec = mdxSpec
    ? {
        ...mdxSpec,
        ...(mdxSpec.editorSpec
          ? {
              editorSpec: {
                ...mdxSpec.editorSpec,
                ...(normalizedSlashCommand ? { slashCommand: normalizedSlashCommand } : {})
              }
            }
          : {})
      }
    : undefined;

  return {
    type,
    category,
    surfaces,
    ...(normalizedMdxSpec ? { mdx: normalizedMdxSpec } : {}),
    ...(normalizedDashboardWidget ? { dashboardWidget: normalizedDashboardWidget } : {})
  };
}
