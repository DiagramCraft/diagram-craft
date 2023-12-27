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

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(
    new ReactNodeDefinition('rect', 'Rectangle', Rect, {
      getBoundingPath: Rect.getBoundingPath
    })
  );
  dest.register(
    new ReactNodeDefinition('rounded-rect', 'Rounded Rectangle', RoundedRect, {
      getBoundingPath: RoundedRect.getBoundingPath,
      getCustomProperties: RoundedRect.getCustomProperties
    })
  );
  dest.register(
    new ReactNodeDefinition('circle', 'Circle', Circle, {
      getBoundingPath: Circle.getBoundingPath
    })
  );
  dest.register(
    new ReactNodeDefinition('text', 'Text', Text, {
      getBoundingPath: Rect.getBoundingPath,
      defaultPropsFactory: Text.defaultPropsFactory,
      initialConfig: Text.initialConfig
    })
  );
  dest.register(
    new ReactNodeDefinition('star', 'Star', Star, {
      getBoundingPath: Star.getBoundingPath,
      getCustomProperties: Star.getCustomProperties
    })
  );
  dest.register(
    new ReactNodeDefinition('regular-polygon', 'Regular Polygon', RegularPolygon, {
      getBoundingPath: RegularPolygon.getBoundingPath,
      getCustomProperties: RegularPolygon.getCustomProperties
    })
  );
  dest.register(
    new ReactNodeDefinition('parallelogram', 'Parallelogram', Parallelogram, {
      getBoundingPath: Parallelogram.getBoundingPath,
      getCustomProperties: Parallelogram.getCustomProperties
    })
  );
  dest.register(
    new ReactNodeDefinition('trapetzoid', 'Trapetzoid', Trapetzoid, {
      getBoundingPath: Trapetzoid.getBoundingPath,
      getCustomProperties: Trapetzoid.getCustomProperties
    })
  );
  dest.register(
    new ReactNodeDefinition('diamond', 'Diamond', Diamond, {
      getBoundingPath: Diamond.getBoundingPath
    })
  );
  dest.register(
    new ReactNodeDefinition('group', 'Group', Group, {
      getBoundingPath: Group.getBoundingPath
    })
  );
  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
