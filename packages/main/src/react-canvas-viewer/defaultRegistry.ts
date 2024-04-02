import { Star, StarNodeDefinition } from './node-types/Star.tsx';
import { Rect } from './node-types/Rect.tsx';
import { Text, TextNodeDefinition } from './node-types/Text.tsx';
import { RoundedRect, RoundedRectNodeDefinition } from './node-types/RoundedRect.tsx';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '../model/elementDefinitionRegistry.ts';
import { Circle, CircleNodeDefinition } from './node-types/Circle.tsx';
import { Diamond, DiamondNodeDefinition } from './node-types/Diamond.tsx';
import { RegularPolygon, RegularPolygonNodeDefinition } from './node-types/RegularPolygon.tsx';
import { Parallelogram, ParallelogramNodeDefinition } from './node-types/Parallelogram.tsx';
import { Trapetzoid, TrapetzoidNodeDefinition } from './node-types/Trapetzoid.tsx';
import { Group, GroupNodeDefinition } from './node-types/Group.tsx';
import { Container, ContainerNodeDefinition } from './node-types/Container.tsx';
import { GenericPath, GenericPathNodeDefinition } from './node-types/GenericPath.tsx';
import { RectNodeDefinition } from './node-types/Rect.nodeType.ts';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(new ReactNodeDefinition(Rect, new RectNodeDefinition()));
  dest.register(new ReactNodeDefinition(RoundedRect, new RoundedRectNodeDefinition()));
  dest.register(new ReactNodeDefinition(Circle, new CircleNodeDefinition()));
  dest.register(new ReactNodeDefinition(Text, new TextNodeDefinition()));
  dest.register(new ReactNodeDefinition(Star, new StarNodeDefinition()));
  dest.register(new ReactNodeDefinition(RegularPolygon, new RegularPolygonNodeDefinition()));
  dest.register(new ReactNodeDefinition(Parallelogram, new ParallelogramNodeDefinition()));
  dest.register(new ReactNodeDefinition(Trapetzoid, new TrapetzoidNodeDefinition()));
  dest.register(new ReactNodeDefinition(Diamond, new DiamondNodeDefinition()));
  dest.register(new ReactNodeDefinition(GenericPath, new GenericPathNodeDefinition()));
  dest.register(new ReactNodeDefinition(Container, new ContainerNodeDefinition()));

  // Note: group must be the last element
  dest.register(new ReactNodeDefinition(Group, new GroupNodeDefinition()));

  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
