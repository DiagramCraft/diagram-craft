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
  dest.register(new ReactNodeDefinition(Rect, new RectNodeDefinition(), () => new RectComponent()));
  dest.register(
    new ReactNodeDefinition(
      RoundedRect,
      new RoundedRectNodeDefinition(),
      () => new RoundedRectComponent()
    )
  );
  dest.register(
    new ReactNodeDefinition(Circle, new CircleNodeDefinition(), () => new CircleComponent())
  );
  dest.register(new ReactNodeDefinition(Text, new TextNodeDefinition(), () => new TextComponent()));
  dest.register(new ReactNodeDefinition(Star, new StarNodeDefinition(), () => new StarComponent()));
  dest.register(
    new ReactNodeDefinition(
      RegularPolygon,
      new RegularPolygonNodeDefinition(),
      () => new RegularPolygonComponent()
    )
  );
  dest.register(
    new ReactNodeDefinition(
      Parallelogram,
      new ParallelogramNodeDefinition(),
      () => new ParallelogramComponent()
    )
  );
  dest.register(
    new ReactNodeDefinition(
      Trapetzoid,
      new TrapetzoidNodeDefinition(),
      () => new TrapetzoidComponent()
    )
  );
  dest.register(
    new ReactNodeDefinition(Diamond, new DiamondNodeDefinition(), () => new DiamondComponent())
  );
  dest.register(
    new ReactNodeDefinition(
      GenericPath,
      new GenericPathNodeDefinition(),
      () => new GenericPathComponent()
    )
  );
  dest.register(
    new ReactNodeDefinition(
      Container,
      new ContainerNodeDefinition(),
      () => new ContainerComponent()
    )
  );

  // Note: group must be the last element
  dest.register(
    new ReactNodeDefinition(Group, new GroupNodeDefinition(), () => new GroupComponent())
  );

  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
