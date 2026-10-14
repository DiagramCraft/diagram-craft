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
  ComponentIcon,
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
>;

type DashboardWidgetRegistrationDef<Config extends Record<string, unknown>> = Omit<
  DashboardWidgetSpec<Config>,
  'label' | 'description'
>;

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

export type MdxComponentRegistrationDef<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
> = {
  mode: Mode;
  allowedProps: ReadonlyArray<AllowedPropKey<P>>;
  /** Converts authored MDX string attributes to the shared component's props using defaults. */
  mapProps?: (
    props: Record<string, string>,
    defaultProps: Record<string, unknown>
  ) => Record<string, unknown>;
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
};

type ComponentRegistrationBase = {
  /** Stable identity used by MDX and persisted dashboard widget instances. */
  type: string;
  /** Shared display name and description for component catalogs. */
  name: string;
  description: string;
  /** Shared category shown in the wiki and dashboard catalogs. */
  category: ComponentCategory;
  /** One icon reused by dashboard, MDX, and editor surfaces. */
  icon?: ComponentIcon;
};

export type ComponentRegistration<
  E extends TElement,
  P extends Record<string, unknown>,
  Mode extends MdxMode
> = ComponentRegistrationBase & {
  /** Shared renderer for the component, independent of the surface using it. */
  // biome-ignore lint/suspicious/noExplicitAny: component props vary by registration and are typed by each surface adapter
  component: React.ComponentType<any>;
  /** Shared config editor, when this component has editable options. */
  // biome-ignore lint/suspicious/noExplicitAny: component config types are erased in the registry
  configForm?: React.ComponentType<any>;
  /** Present when this component can be authored in wiki content. */
  mdxComponent?: MdxComponentRegistrationDef<E, P, Mode>;
  /** Present when this component can be added as a dashboard widget. */
  // biome-ignore lint/suspicious/noExplicitAny: registrations erase per-widget config types here
  dashboardWidget?: DashboardWidgetRegistrationDef<any>;
  /** Creates fresh default props for the shared renderer. */
  createDefaultProps?: (context: { viewId?: string }) => Record<string, unknown>;
};

/**
 * Declares one component registration with shared identity, renderer and form.
 * Content surfaces are derived from the presence of `mdxComponent` and
 * `dashboardWidget`. Their editor/serialization and dashboard details stay
 * nested under the registration they belong to.
 */
export function defineComponent<
  E extends TElement = TElement,
  P extends Record<string, unknown> = Record<string, unknown>,
  Mode extends MdxMode = MdxMode
>(def: ComponentRegistration<E, P, Mode>): ComponentDefinition {
  const {
    type,
    name,
    description,
    category,
    icon,
    component,
    configForm,
    dashboardWidget,
    createDefaultProps
  } = def;
  const mdxComponent = 'mdxComponent' in def ? def.mdxComponent : undefined;
  if ((dashboardWidget || mdxComponent?.editorSpec?.slashCommand) && !icon) {
    throw new Error(`Component "${type}" must define an icon for its catalog entry`);
  }
  const surfaces: ComponentSurface[] = [];
  if (mdxComponent) surfaces.push('wiki');
  if (dashboardWidget) surfaces.push('dashboard');
  if (dashboardWidget && !createDefaultProps) {
    throw new Error(`Dashboard component "${type}" must define createDefaultProps`);
  }
  const normalizedDashboardWidget = dashboardWidget
    ? { ...dashboardWidget, label: name, description }
    : undefined;
  const normalizedMdxComponent = mdxComponent
    ? {
        ...mdxComponent,
        ...(mdxComponent.editorSpec
          ? {
              editorSpec: {
                ...mdxComponent.editorSpec,
                ...(mdxComponent.editorSpec.slashCommand
                  ? {
                      slashCommand: {
                        ...mdxComponent.editorSpec.slashCommand,
                        label: name,
                        description
                      }
                    }
                  : {})
              }
            }
          : {})
      }
    : undefined;

  return {
    type,
    name,
    description,
    category,
    surfaces,
    component,
    ...(icon ? { icon } : {}),
    ...(createDefaultProps ? { createDefaultProps } : {}),
    ...(configForm ? { configForm } : {}),
    ...(normalizedMdxComponent
      ? { mdx: normalizedMdxComponent as unknown as MdxComponentSpec }
      : {}),
    ...(normalizedDashboardWidget ? { dashboardWidget: normalizedDashboardWidget } : {})
  };
}
