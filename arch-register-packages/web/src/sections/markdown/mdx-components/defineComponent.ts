import type React from 'react';
import type { TElement } from 'platejs';
import type {
  ComponentDefinition,
  ComponentIcon,
  ComponentSurface,
  DashboardWidgetSpec,
  MdxComponentRegistrationDef,
  MdxComponentSpec,
  MdxMode
} from './types';
import type { ComponentCategory } from './componentCategories';

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

/** Dashboard details as authored; label and description come from the registration itself. */
type DashboardWidgetRegistrationDef<Config extends Record<string, unknown>> = Omit<
  DashboardWidgetSpec<Config>,
  'label' | 'description'
>;

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
/** Completes the authored slash command with the registration's catalog text. */
const toMdxSpec = <E extends TElement, P extends Record<string, unknown>, Mode extends MdxMode>(
  { editorSpec, ...rest }: MdxComponentRegistrationDef<E, P, Mode>,
  name: string,
  description: string
): MdxComponentSpec => {
  if (!editorSpec) return rest;
  const { slashCommand, ...editorRest } = editorSpec;
  return {
    ...rest,
    editorSpec: {
      ...editorRest,
      ...(slashCommand ? { slashCommand: { ...slashCommand, label: name, description } } : {})
    }
  };
};

export function defineComponent<
  E extends TElement = TElement,
  P extends Record<string, unknown> = Record<string, unknown>,
  Mode extends MdxMode = MdxMode
>(def: ComponentRegistration<E, P, Mode>): ComponentDefinition {
  const { type, name, description, category, icon, component, configForm } = def;
  const { mdxComponent, dashboardWidget, createDefaultProps } = def;

  if ((dashboardWidget || mdxComponent?.editorSpec?.slashCommand) && !icon) {
    throw new Error(`Component "${type}" must define an icon for its catalog entry`);
  }
  if (dashboardWidget && !createDefaultProps) {
    throw new Error(`Dashboard component "${type}" must define createDefaultProps`);
  }

  const surfaces: ComponentSurface[] = [];
  if (mdxComponent) surfaces.push('wiki');
  if (dashboardWidget) surfaces.push('dashboard');

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
    ...(mdxComponent ? { mdx: toMdxSpec(mdxComponent, name, description) } : {}),
    ...(dashboardWidget
      ? { dashboardWidget: { ...dashboardWidget, label: name, description } }
      : {})
  };
}
