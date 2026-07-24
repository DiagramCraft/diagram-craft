import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbVectorTriangle } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { EntityGraph } from './EntityGraph';
import {
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection,
  type EntityGraphSlateElement
} from './types';
import { EntityGraphDialog } from './EntityGraphDialog';

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

export const EntityGraphEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityGraphSlateElement>) => {
  const entityId = element.entityId ?? '';
  const depth = normalizeEntityGraphDepth(element.depth);
  const direction = normalizeEntityGraphDirection(element.direction);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={!!entityId}
      fullWidth
      placeholder={
        <>
          <TbVectorTriangle size={16} />
          <span>Choose entity graph…</span>
        </>
      }
      content={<EntityGraph id={entityId} depth={String(depth)} direction={direction} />}
      dialog={(open, onClose) => (
        <EntityGraphDialog element={element} open={open} onClose={onClose} isNew={!entityId} />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
