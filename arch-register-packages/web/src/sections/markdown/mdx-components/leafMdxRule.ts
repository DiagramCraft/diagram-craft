import { getPluginType, type TElement } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import type { MdxMode, MdxRuleDef } from './types';

type LeafField<E extends TElement> = {
  /** Slate element field holding the value. */
  key: Exclude<keyof E & string, 'children' | 'type'>;
  /** MDX attribute name; defaults to `key`. */
  attr?: string;
  /** Always written, even when empty (identifying attributes such as `id`). */
  required?: boolean;
  /** Not written while the value equals this default. */
  default?: string;
};

type LeafMdxRuleOptions<E extends TElement, Mode extends MdxMode> = {
  /** The JSX element name, which is also the Plate plugin key. */
  name: string;
  mode: Mode;
  fields: ReadonlyArray<LeafField<E>>;
};

/** Reads an authored MDX attribute as a string; absent attributes become `''`. */
export const readStringAttr = (attrs: Record<string, unknown>, key: string): string => {
  const value = attrs[key];
  return value == null ? '' : String(value);
};

/**
 * Builds the MDX rule for a childless component whose Slate element stores each attribute as a
 * plain string. Empty values are omitted on serialization unless the field is `required`.
 * Components with typed attributes or children write their rule by hand.
 */
export const defineLeafMdxRule = <E extends TElement, Mode extends MdxMode>({
  name,
  mode,
  fields
}: LeafMdxRuleOptions<E, Mode>): MdxRuleDef<E, Mode> => ({
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, name),
      ...Object.fromEntries(
        fields.map(field => [field.key, readStringAttr(attrs, field.attr ?? field.key)])
      )
    } as unknown as E;
  },
  serialize: slateNode => {
    const values = slateNode as unknown as Record<string, unknown>;
    return {
      attributes: propsToAttributes(
        Object.fromEntries(
          fields.flatMap(field => {
            const value = values[field.key];
            const text = typeof value === 'string' ? value : '';
            if (field.required) return [[field.attr ?? field.key, text]];
            return text && text !== field.default ? [[field.attr ?? field.key, text]] : [];
          })
        )
      ),
      children: [],
      name,
      type: mode === 'block' ? 'mdxJsxFlowElement' : 'mdxJsxTextElement'
    } as ReturnType<MdxRuleDef<E, Mode>['serialize']>;
  }
});
