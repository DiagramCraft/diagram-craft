import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '../model/elementDefinitionRegistry.ts';
import { RectNodeDefinition } from './node-types/Rect.nodeType.ts';
import { CircleNodeDefinition } from './node-types/Circle.nodeType.ts';
import { DiamondNodeDefinition } from './node-types/Diamond.nodeType.ts';
import { ParallelogramNodeDefinition } from './node-types/Parallelogram.nodeType.ts';
import { RegularPolygonNodeDefinition } from './node-types/RegularPolygon.nodeType.ts';
import { RoundedRectNodeDefinition } from './node-types/RoundedRect.nodeType.ts';
import { StarNodeDefinition } from './node-types/Star.nodeType.ts';
import { TrapetzoidNodeDefinition } from './node-types/Trapetzoid.nodeType.ts';
import { TextNodeDefinition } from './node-types/Text.nodeType.ts';
import { ContainerNodeDefinition } from './node-types/Container.nodeType.ts';
import { GenericPathNodeDefinition } from './node-types/GenericPath.nodeType.ts';
import { GroupNodeDefinition } from './node-types/Group.nodeType.ts';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(new RectNodeDefinition());
  dest.register(new RoundedRectNodeDefinition());
  dest.register(new CircleNodeDefinition());
  dest.register(new TextNodeDefinition());
  dest.register(new StarNodeDefinition());
  dest.register(new RegularPolygonNodeDefinition());
  dest.register(new ParallelogramNodeDefinition());
  dest.register(new TrapetzoidNodeDefinition());
  dest.register(new DiamondNodeDefinition());
  dest.register(new GenericPathNodeDefinition());
  dest.register(new ContainerNodeDefinition());

  // Note: group must be the last element
  dest.register(new GroupNodeDefinition());

  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
