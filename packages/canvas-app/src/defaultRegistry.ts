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
import { DrawioShapeNodeDefinition } from './drawio/DrawioShape.nodeType';
import { DrawioImageNodeDefinition } from './drawio/DrawioImage.nodeType';
import { HexagonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Hexagon.nodeType';
import { TriangleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Triangle.nodeType';
import { ProcessNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Process.nodeType';

export const defaultNodeRegistry = () => {
  const dest = new NodeDefinitionRegistry();
  dest.register(new GroupNodeDefinition(), { hidden: true });

  dest.register(new RectNodeDefinition());
  dest.register(new RoundedRectNodeDefinition());
  dest.register(new CircleNodeDefinition());
  dest.register(new TextNodeDefinition());
  dest.register(new StarNodeDefinition());
  dest.register(new RegularPolygonNodeDefinition());
  dest.register(new ParallelogramNodeDefinition());
  dest.register(new TrapetzoidNodeDefinition());
  dest.register(new DiamondNodeDefinition());
  dest.register(new HexagonNodeDefinition());
  dest.register(new TriangleNodeDefinition());
  dest.register(new ProcessNodeDefinition());
  dest.register(new GenericPathNodeDefinition(), { hidden: true });
  dest.register(new ContainerNodeDefinition());

  dest.register(new DrawioShapeNodeDefinition(), { hidden: true });
  dest.register(new DrawioImageNodeDefinition(), { hidden: true });

  return dest;
};

export const defaultEdgeRegistry = () => {
  return new EdgeDefinitionRegistry();
};
