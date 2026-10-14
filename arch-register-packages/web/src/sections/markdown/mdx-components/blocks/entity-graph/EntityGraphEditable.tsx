import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import type { MdxRuleDef } from '../../types';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  type EntityGraphSlateElement,
  type EntityGraphWidgetConfig
} from './types';

export const ENTITY_GRAPH_TYPE = 'EntityGraph' as const;

const readAttr = (attrs: Record<string, unknown>, key: string): string | undefined => {
  const value = attrs[key];
  return value == null || value === '' ? undefined : String(value);
};

export const entityGraphMdxRule: MdxRuleDef<EntityGraphSlateElement, 'block'> = {
  deserialize: (mdastNode, _deco, options) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    const depth = readAttr(attrs, 'depth');
    const direction = readAttr(attrs, 'direction');
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor!, ENTITY_GRAPH_TYPE),
      entityId: readAttr(attrs, 'id') ?? '',
      ...(depth !== undefined ? { depth: normalizeEntityGraphDepth(depth) } : {}),
      ...(direction !== undefined ? { direction: normalizeEntityGraphDirection(direction) } : {})
    };
  },
  serialize: slateNode => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      ...(normalizeEntityGraphDepth(slateNode.depth) !== 1
        ? { depth: String(normalizeEntityGraphDepth(slateNode.depth)) }
        : {}),
      ...(normalizeEntityGraphDirection(slateNode.direction) !== 'both'
        ? { direction: normalizeEntityGraphDirection(slateNode.direction) }
        : {})
    }),
    children: [],
    name: ENTITY_GRAPH_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

export const entityGraphMdxConfigSpec: MdxConfigSpec<
  EntityGraphSlateElement,
  EntityGraphWidgetConfig
> = {
  width: 440,
  fromElement: el => ({
    entityId: el.entityId ?? '',
    depth: normalizeEntityGraphDepth(el.depth),
    direction: normalizeEntityGraphDirection(el.direction)
  }),
  toElement: config => ({
    entityId: config.entityId,
    depth: config.depth,
    direction: config.direction
  })
};

export const EntityGraphEditable = (props: PlateElementProps<EntityGraphSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={ENTITY_GRAPH_TYPE}
    placeholder="Choose entity graph…"
    fullWidth
    configSpec={entityGraphMdxConfigSpec}
    hasValue={el => !!el.entityId}
    previewProps={el => ({
      id: el.entityId ?? '',
      depth: String(normalizeEntityGraphDepth(el.depth)),
      direction: normalizeEntityGraphDirection(el.direction)
    })}
  />
);
