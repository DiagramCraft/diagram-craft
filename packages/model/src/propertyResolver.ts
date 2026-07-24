import { deepMerge } from '@diagram-craft/utils/object';
import type { DeepPartial } from '@diagram-craft/utils/types';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import type { Defaults } from './diagramDefaults';
import type { PropertyInfo } from './property';

export type PropertySourceType =
  | 'default'
  | 'stored'
  | 'style'
  | 'textStyle'
  | 'rule'
  | 'ruleStyle'
  | 'ruleTextStyle'
  | 'parent';

export type PropertySourceMode = 'info-only' | 'editing' | 'rendering' | 'editing-and-rendering';

/**
 * A property source in precedence order.
 *
 * `props` is the value used for resolution. `infoProps` allows callers to
 * preserve the original value for provenance when resolution needs a
 * source-specific normalization (for example, node text styles).
 */
export type PropertySource<P extends object> = {
  type: PropertySourceType;
  props?: Partial<P> | DeepPartial<P>;
  infoProps?: Partial<P> | DeepPartial<P>;
  id?: string;
  mode: PropertySourceMode;
};

const isEditingSource = (source: PropertySource<object>) =>
  source.mode === 'editing' || source.mode === 'editing-and-rendering';

const isRenderingSource = (source: PropertySource<object>) =>
  source.mode === 'rendering' || source.mode === 'editing-and-rendering';

export const resolveEditProps = <P extends object>(sources: ReadonlyArray<PropertySource<P>>): P =>
  deepMerge<Record<string, unknown>>(
    {},
    ...sources.filter(isEditingSource).map(source => source.props as Record<string, unknown>)
  ) as P;

export const resolveRenderProps = <P extends object>(
  sources: ReadonlyArray<PropertySource<P>>,
  defaults: Defaults<P>
): P => {
  const merged = deepMerge<Record<string, unknown>>(
    {},
    ...sources.filter(isRenderingSource).map(source => source.props as Record<string, unknown>)
  );
  return defaults.applyDefaults(merged as DeepPartial<P>) as P;
};

export const resolvePropsInfo = <P extends object, T extends PropPath<P>>(
  sources: ReadonlyArray<PropertySource<P>>,
  defaults: Defaults<P>,
  path: T,
  defaultValue?: PropPathValue<P, T>
): PropertyInfo<PropPathValue<P, T>> => {
  const accessor = new DynamicAccessor<P>();

  return sources
    .map(source => {
      const val =
        source.type === 'default'
          ? defaultValue !== undefined
            ? defaultValue
            : defaults.get(path)
          : accessor.get((source.infoProps ?? source.props) as P, path);

      const entry: {
        val: PropPathValue<P, T>;
        type: PropertySourceType;
        id?: string;
      } = {
        val: val as PropPathValue<P, T>,
        type: source.type
      };
      if (source.id !== undefined) entry.id = source.id;
      return entry;
    })
    .filter(source => source.val !== undefined) as PropertyInfo<PropPathValue<P, T>>;
};

export const _test = {
  resolvePropsInfo,
  resolveEditProps,
  resolveRenderProps
};
