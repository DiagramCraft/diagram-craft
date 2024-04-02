import { Star } from './node-types/Star.tsx';
import { Rect } from './node-types/Rect.tsx';
import { Text } from './node-types/Text.tsx';
import { RoundedRect } from './node-types/RoundedRect.tsx';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '../model/elementDefinitionRegistry.ts';
import { Circle } from './node-types/Circle.tsx';
import { Diamond } from './node-types/Diamond.tsx';
import { RegularPolygon } from './node-types/RegularPolygon.tsx';
import { Parallelogram } from './node-types/Parallelogram.tsx';
import { Trapetzoid } from './node-types/Trapetzoid.tsx';
import { Group } from './node-types/Group.tsx';
import { Container } from './node-types/Container.tsx';
import { GenericPath } from './node-types/GenericPath.tsx';
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
