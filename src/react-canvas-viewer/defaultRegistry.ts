import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../model-viewer/diagram.ts';
import { Star } from './node-types/Star.tsx';
import { Rect } from './node-types/Rect.tsx';
import { RoundedRect } from './node-types/RoundedRect.tsx';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(new ReactNodeDefinition('star', Star));
  dest.register(new ReactNodeDefinition('rect', Rect));
  dest.register(new ReactNodeDefinition('rounded-rect', RoundedRect));
  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
