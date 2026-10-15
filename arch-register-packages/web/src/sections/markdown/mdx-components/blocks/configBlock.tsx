import type { TElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../leafMdxRule';
import type { ConfigCodec } from '../configSchema';
import type { MdxSpec, MdxSpecFactory } from '../types';
import { ConfigurableBlockEditable } from './ConfigurableBlockEditable';
import type { MdxConfigSpec } from './MdxWidgetConfigDialog';

type ConfigBlockOptions = {
  codec: ConfigCodec;
  /** Shown while the block has no configuration yet. */
  placeholder: string;
  /** Stretches the preview to the full editor width. */
  fullWidth?: boolean;
};

/**
 * MDX spec for a void block that is configured through its shared config form and whose
 * config is described by `codec`: the allowed attributes, MDX rule, editor element, slash command
 * and the string⇄config mapping are all derived from it. The JSX element name (and Plate plugin
 * key) is the owning component's `type`, supplied by `defineComponent`.
 */
export const configBlockMdx =
  ({ codec, placeholder, fullWidth }: ConfigBlockOptions): MdxSpecFactory =>
  (type): MdxSpec => {
    const attributeOf = (key: string): string => codec.attributeNames[key] ?? key;
    const fieldsOf = (element: TElement): Record<string, string> =>
      Object.fromEntries(
        codec.keys.map(key => {
          const value = element[key];
          return [key, typeof value === 'string' ? value : ''];
        })
      );

    const configSpec: MdxConfigSpec<TElement, Record<string, unknown>> = {
      fromElement: (element, defaults) => codec.decode(fieldsOf(element), defaults),
      toElement: config => codec.encode(config)
    };

    const Editable = (props: PlateElementProps<TElement>) => (
      <ConfigurableBlockEditable
        {...props}
        componentType={type}
        placeholder={placeholder}
        fullWidth={fullWidth}
        configSpec={configSpec}
        hasValue={element => codec.keys.some(key => !!fieldsOf(element)[key])}
        previewProps={element =>
          Object.fromEntries(
            Object.entries(fieldsOf(element)).map(([key, value]) => [attributeOf(key), value])
          )
        }
      />
    );

    return {
      mode: 'block',
      allowedProps: codec.keys.map(attributeOf),
      mapProps: (props, defaultConfig) => {
        const fields = Object.fromEntries(
          codec.keys.map(key => [key, props[attributeOf(key)] ?? ''])
        );
        return { config: codec.decode(fields, defaultConfig) };
      },
      editorSpec: {
        editableComponent: Editable,
        nodeOptions: { isVoid: true },
        mdxRule: defineLeafMdxRule<TElement, 'block'>({
          name: type,
          mode: 'block',
          fields: codec.keys.map(key => ({ key, attr: attributeOf(key) }))
        }),
        slashCommand: {
          onSelect: (editor, { insertOrReplaceBlock }) =>
            insertOrReplaceBlock(editor, { type, children: [{ text: '' }] })
        }
      }
    };
  };
