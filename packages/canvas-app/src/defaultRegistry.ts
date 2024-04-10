import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '@diagram-craft/model/index.ts';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType.ts';
import { CircleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Circle.nodeType.ts';
import { DiamondNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Diamond.nodeType.ts';
import { ParallelogramNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Parallelogram.nodeType.ts';
import { RegularPolygonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RegularPolygon.nodeType.ts';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType.ts';
import { StarNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Star.nodeType.ts';
import { TrapetzoidNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Trapetzoid.nodeType.ts';
import { TextNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Text.nodeType.ts';
import { ContainerNodeDefinition } from '@diagram-craft/canvas/node-types/Container.nodeType.ts';
import { GenericPathNodeDefinition } from '@diagram-craft/canvas/node-types/GenericPath.nodeType.ts';
import { GroupNodeDefinition } from '@diagram-craft/canvas/node-types/Group.nodeType.ts';

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
