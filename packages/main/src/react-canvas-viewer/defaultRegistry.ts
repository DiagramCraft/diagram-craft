import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '../model/elementDefinitionRegistry.ts';
import { RectComponent, RectNodeDefinition } from './node-types/Rect.nodeType.ts';
import { CircleComponent, CircleNodeDefinition } from './node-types/Circle.nodeType.ts';
import { DiamondComponent, DiamondNodeDefinition } from './node-types/Diamond.nodeType.ts';
import {
  ParallelogramComponent,
  ParallelogramNodeDefinition
} from './node-types/Parallelogram.nodeType.ts';
import {
  RegularPolygonComponent,
  RegularPolygonNodeDefinition
} from './node-types/RegularPolygon.nodeType.ts';
import {
  RoundedRectComponent,
  RoundedRectNodeDefinition
} from './node-types/RoundedRect.nodeType.ts';
import { StarComponent, StarNodeDefinition } from './node-types/Star.nodeType.ts';
import { TrapetzoidComponent, TrapetzoidNodeDefinition } from './node-types/Trapetzoid.nodeType.ts';
import { TextComponent, TextNodeDefinition } from './node-types/Text.nodeType.ts';
import { ContainerComponent, ContainerNodeDefinition } from './node-types/Container.nodeType.ts';
import {
  GenericPathComponent,
  GenericPathNodeDefinition
} from './node-types/GenericPath.nodeType.ts';
import { GroupComponent, GroupNodeDefinition } from './node-types/Group.nodeType.ts';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(new ReactNodeDefinition(new RectNodeDefinition(), () => new RectComponent()));
  dest.register(
    new ReactNodeDefinition(new RoundedRectNodeDefinition(), () => new RoundedRectComponent())
  );
  dest.register(new ReactNodeDefinition(new CircleNodeDefinition(), () => new CircleComponent()));
  dest.register(new ReactNodeDefinition(new TextNodeDefinition(), () => new TextComponent()));
  dest.register(new ReactNodeDefinition(new StarNodeDefinition(), () => new StarComponent()));
  dest.register(
    new ReactNodeDefinition(new RegularPolygonNodeDefinition(), () => new RegularPolygonComponent())
  );
  dest.register(
    new ReactNodeDefinition(new ParallelogramNodeDefinition(), () => new ParallelogramComponent())
  );
  dest.register(
    new ReactNodeDefinition(new TrapetzoidNodeDefinition(), () => new TrapetzoidComponent())
  );
  dest.register(new ReactNodeDefinition(new DiamondNodeDefinition(), () => new DiamondComponent()));
  dest.register(
    new ReactNodeDefinition(new GenericPathNodeDefinition(), () => new GenericPathComponent())
  );
  dest.register(
    new ReactNodeDefinition(new ContainerNodeDefinition(), () => new ContainerComponent())
  );

  // Note: group must be the last element
  dest.register(new ReactNodeDefinition(new GroupNodeDefinition(), () => new GroupComponent()));

  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
