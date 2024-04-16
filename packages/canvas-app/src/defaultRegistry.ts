import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { CircleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Circle.nodeType';
import { DiamondNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Diamond.nodeType';
import { ParallelogramNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Parallelogram.nodeType';
import { RegularPolygonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RegularPolygon.nodeType';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import { StarNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Star.nodeType';
import { TrapetzoidNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Trapetzoid.nodeType';
import { TextNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Text.nodeType';
import { ContainerNodeDefinition } from '@diagram-craft/canvas/node-types/Container.nodeType';
import { GenericPathNodeDefinition } from '@diagram-craft/canvas/node-types/GenericPath.nodeType';
import { GroupNodeDefinition } from '@diagram-craft/canvas/node-types/Group.nodeType';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '@diagram-craft/model/elementDefinitionRegistry';

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
