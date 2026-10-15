import type { z } from 'zod';
import type { TElement } from 'platejs';
import type { ComponentDefinition, ConfigSchema, MdxMode, MdxSpec, MdxSpecFactory } from './types';

/** What `defineComponent` accepts: a definition whose dashboard callbacks are typed by the schema. */
type ComponentInput<E extends TElement, Mode extends MdxMode, Schema extends ConfigSchema> = Omit<
  ComponentDefinition<z.infer<Schema>, E, Mode>,
  'configSchema' | 'mdx'
> & {
  configSchema?: Schema;
  /** A factory is given the component's `type`, for specs that are derived from it. */
  mdx?: MdxSpec<E, Mode> | MdxSpecFactory;
};

/**
 * Declares one component. It checks the config types (`configSchema` types the dashboard
 * callbacks, `E` the editor element), resolves an `mdx` factory and validates that the component
 * has what its catalog entries need.
 */
export function defineComponent<
  E extends TElement = TElement,
  Mode extends MdxMode = MdxMode,
  Schema extends ConfigSchema = ConfigSchema
>(def: ComponentInput<E, Mode, Schema>): ComponentDefinition {
  const { type, icon, dashboardWidget, configSchema } = def;
  const mdx = typeof def.mdx === 'function' ? (def.mdx(type) as MdxSpec<E, Mode>) : def.mdx;

  if ((dashboardWidget || mdx?.editorSpec?.slashCommand) && !icon) {
    throw new Error(`Component "${type}" must define an icon for its catalog entry`);
  }
  if (dashboardWidget && !configSchema) {
    throw new Error(`Dashboard component "${type}" must define configSchema`);
  }

  // The registry holds components with different configs and elements, so these are erased.
  return { ...def, mdx } as unknown as ComponentDefinition;
}
