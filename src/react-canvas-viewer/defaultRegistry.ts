import { Star } from './node-types/Star.tsx';
import { Rect } from './node-types/Rect.tsx';
import { RoundedRect } from './node-types/RoundedRect.tsx';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../model-viewer/nodeDefinition.ts';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(
    new ReactNodeDefinition('star', 'Star', Star, Star.getBoundingPath, Star.getCustomProperties)
  );
  dest.register(new ReactNodeDefinition('rect', 'Rectangle', Rect));
  dest.register(
    new ReactNodeDefinition(
      'rounded-rect',
      'Rounded Rectangle',
      RoundedRect,
      undefined,
      RoundedRect.getCustomProperties
    )
  );
  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
