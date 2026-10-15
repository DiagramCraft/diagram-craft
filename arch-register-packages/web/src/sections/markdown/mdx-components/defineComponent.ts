import type React from 'react';
import type { z } from 'zod';
import type { TElement } from 'platejs';
import type {
  ComponentDefinition,
  ComponentIcon,
  ConfigDialogSpec,
  ConfigSchema,
  DashboardWidgetSpec,
  DefaultConfigContext,
  MdxComponentFactory,
  MdxComponentRegistrationDef,
  MdxComponentSpec,
  MdxMode
} from './types';
import type { ComponentCategory } from './componentCategories';
import { initialConfigOf } from './configSchema';

type ComponentRegistrationBase = {
  /** Stable identity used by MDX and persisted dashboard widget instances. */
  type: string;
  /** Shared display name and description for component catalogs. */
  name: string;
  description: string;
  /** Extra search terms for the slash menu, beyond the name and description. */
  keywords?: string[];
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
  Mode extends MdxMode,
  Schema extends ConfigSchema
> = ComponentRegistrationBase & {
  /** Shared renderer for the component, independent of the surface using it. */
  // biome-ignore lint/suspicious/noExplicitAny: component props vary by registration and are typed by each surface adapter
  component: React.ComponentType<any>;
  /**
   * The component's config: its shape, and which configs are valid (and complete enough to save).
   * Also types the dashboard callbacks below.
   */
  configSchema?: Schema;
  /** Size of the dialog hosting `configForm`. */
  configDialog?: ConfigDialogSpec;
  /** Shared config editor, when this component has editable options. */
  // biome-ignore lint/suspicious/noExplicitAny: component config types are erased in the registry
  configForm?: React.ComponentType<any>;
  /** Present when this component can be authored in wiki content. */
  mdxComponent?: MdxComponentRegistrationDef<E, Mode> | MdxComponentFactory;
  /** Present when this component can be added as a dashboard widget; requires `configSchema`. */
  dashboardWidget?: DashboardWidgetRegistrationDef<z.infer<Schema>>;
  /**
   * Starting config values that depend on the creation context, which a schema can't declare.
   * The other starting values are declared on `configSchema` with `withInitial`.
   */
  defaultConfig?: (context: DefaultConfigContext) => Record<string, unknown>;
};

/** Completes the authored slash command with the registration's catalog text. */
const toMdxSpec = <E extends TElement, Mode extends MdxMode>(
  { editorSpec, ...rest }: MdxComponentRegistrationDef<E, Mode>,
  name: string,
  description: string,
  keywords: string[] | undefined
): MdxComponentSpec => {
  if (!editorSpec) return rest;
  const { slashCommand, ...editorRest } = editorSpec;
  return {
    ...rest,
    editorSpec: {
      ...editorRest,
      ...(slashCommand
        ? { slashCommand: { ...slashCommand, label: name, description, keywords } }
        : {})
    }
  };
};

/** The starting config: the values declared on the schema, with the context-dependent ones over it. */
const toCreateDefaultConfig = (
  configSchema: ConfigSchema | undefined,
  extra: ((context: DefaultConfigContext) => Record<string, unknown>) | undefined
): ComponentDefinition['createDefaultConfig'] => {
  if (!configSchema) return undefined;
  return context => ({ ...initialConfigOf(configSchema), ...extra?.(context) });
};

/**
 * Declares one component registration with shared identity, renderer and form.
 * Content surfaces are derived from the presence of `mdxComponent` and
 * `dashboardWidget`. Their editor/serialization and dashboard details stay
 * nested under the registration they belong to.
 */
export function defineComponent<
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode,
  Schema extends ConfigSchema = ConfigSchema
>(def: ComponentRegistration<E, Mode, Schema>): ComponentDefinition {
  const { type, name, description, keywords, category, icon, component, configForm, configDialog } =
    def;
  const { dashboardWidget, configSchema } = def;
  const mdxComponent =
    typeof def.mdxComponent === 'function'
      ? (def.mdxComponent(type) as MdxComponentRegistrationDef<E, Mode>)
      : def.mdxComponent;

  if ((dashboardWidget || mdxComponent?.editorSpec?.slashCommand) && !icon) {
    throw new Error(`Component "${type}" must define an icon for its catalog entry`);
  }
  if (dashboardWidget && !configSchema) {
    throw new Error(`Dashboard component "${type}" must define configSchema`);
  }

  const createDefaultConfig = toCreateDefaultConfig(configSchema, def.defaultConfig);

  return {
    type,
    name,
    description,
    category,
    component,
    ...(icon ? { icon } : {}),
    ...(createDefaultConfig ? { createDefaultConfig } : {}),
    ...(configSchema ? { configSchema } : {}),
    ...(configForm ? { configForm } : {}),
    ...(configDialog ? { configDialog } : {}),
    ...(mdxComponent
      ? {
          mdx: toMdxSpec(mdxComponent, name, description, keywords)
        }
      : {}),
    ...(dashboardWidget
      ? { dashboardWidget: { ...dashboardWidget, label: name, description } }
      : {})
  };
}
