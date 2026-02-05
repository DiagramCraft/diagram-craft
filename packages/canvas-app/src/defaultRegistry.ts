import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { CircleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Circle.nodeType';
import { DiamondNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Diamond.nodeType';
import { ParallelogramNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Parallelogram.nodeType';
import { RegularPolygonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RegularPolygon.nodeType';
import { StarNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Star.nodeType';
import { TrapezoidNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Trapezoid.nodeType';
import { TextNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Text.nodeType';
import { ContainerNodeDefinition } from '@diagram-craft/canvas/node-types/Container.nodeType';
import { GenericPathNodeDefinition } from '@diagram-craft/canvas/node-types/GenericPath.nodeType';
import { GroupNodeDefinition } from '@diagram-craft/canvas/node-types/Group.nodeType';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  LazyElementLoaderEntry,
  addStencil,
  StencilPackage,
  StencilRegistry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { HexagonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Hexagon.nodeType';
import { TriangleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Triangle.nodeType';
import { ProcessNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Process.nodeType';
import { ArrowNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Arrow.nodeType';
import { CylinderNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cylinder.nodeType';
import { CurlyBracketNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/CurlyBracket.nodeType';
import { ArcNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Arc.nodeType';
import { BlockArcNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/BlockArc.nodeType';
import { CloudNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cloud.nodeType';
import { BlockArrowEdgeDefinition } from '@diagram-craft/canvas-edges/edge-types/BlockArrow.edgeType';
import { SimpleEdgeDefinition } from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { StepNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Step.nodeType';
import { DelayNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Delay.nodeType';
import { PartialRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/PartialRect.nodeType';
import { CubeNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cube.nodeType';
import { LineNodeDefinition } from '@diagram-craft/canvas/node-types/Line.nodeType';
import { TableNodeDefinition } from '@diagram-craft/canvas/node-types/Table.nodeType';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import stencils from './defaultStencils.yaml';
import { TableRowNodeDefinition } from '@diagram-craft/canvas/node-types/TableRow.nodeType';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { DocumentNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Document.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import { SwimlaneNodeDefinition } from '@diagram-craft/canvas/node-types/Swimlane.nodeType';

export const defaultNodeRegistry = (lazyLoaders: Array<LazyElementLoaderEntry> = []) => {
  const reg = new NodeDefinitionRegistry(lazyLoaders);

  reg.register(new RectNodeDefinition());
  reg.register(new GroupNodeDefinition());
  reg.register(new GenericPathNodeDefinition());
  reg.register(new ContainerNodeDefinition());

  reg.register(new ArrowNodeDefinition('arrow-down', 'Arrow Down', Math.PI / 2));
  reg.register(new ArrowNodeDefinition('arrow-left', 'Arrow Left', Math.PI));
  reg.register(new ArrowNodeDefinition('arrow-right', 'Arrow Right', 0));
  reg.register(new ArrowNodeDefinition('arrow-up', 'Arrow Up', -Math.PI / 2));
  reg.register(new ArcNodeDefinition());
  reg.register(new BlockArcNodeDefinition());
  reg.register(new CircleNodeDefinition());
  reg.register(new CloudNodeDefinition());
  reg.register(new CubeNodeDefinition());
  reg.register(new CurlyBracketNodeDefinition());
  reg.register(new CylinderNodeDefinition());
  reg.register(new DelayNodeDefinition());
  reg.register(new DiamondNodeDefinition());
  reg.register(new DocumentNodeDefinition());
  reg.register(new HexagonNodeDefinition());
  reg.register(new LineNodeDefinition());
  reg.register(new ParallelogramNodeDefinition());
  reg.register(new PartialRectNodeDefinition());
  reg.register(new PartialRectNodeDefinition());
  reg.register(new ProcessNodeDefinition());
  reg.register(new RegularPolygonNodeDefinition());
  reg.register(new RoundedRectNodeDefinition());
  reg.register(new StarNodeDefinition());
  reg.register(new StepNodeDefinition());
  reg.register(new SwimlaneNodeDefinition());
  reg.register(new TableNodeDefinition());
  reg.register(new TableRowNodeDefinition());
  reg.register(new TextNodeDefinition());
  reg.register(new TrapezoidNodeDefinition());
  reg.register(new TriangleNodeDefinition());

  return reg;
};

export const defaultEdgeRegistry = (lazyLoaders: Array<LazyElementLoaderEntry> = []) => {
  const reg = new EdgeDefinitionRegistry(new SimpleEdgeDefinition(), lazyLoaders);
  reg.register(new BlockArrowEdgeDefinition());

  return reg;
};

export const defaultStencilRegistry = () => {
  const stencilRegistry = new StencilRegistry();

  const defaults: StencilPackage = {
    id: 'default',
    name: 'Default',
    stencils: [],
    type: 'default'
  };

  const arrows: StencilPackage = { id: 'arrow', name: 'Arrow', stencils: [], type: 'default' };

  addStencil(defaults, new RectNodeDefinition());
  addStencil(defaults, new RoundedRectNodeDefinition(), {
    props: mode => ({
      custom: {
        roundedRect: {
          radius: mode === 'picker' ? 20 : 10
        }
      }
    })
  });
  addStencil(defaults, new CircleNodeDefinition());
  addStencil(defaults, new TextNodeDefinition(), {
    texts: { text: 'Text' },
    size: { w: 25, h: 10 },
    metadata: {
      style: DefaultStyles.node.text
    },
    props: () => ({
      stroke: {
        enabled: false
      },
      fill: {
        enabled: false
      },
      text: {
        align: 'left',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    })
  });
  addStencil(defaults, new StarNodeDefinition());
  addStencil(defaults, new RegularPolygonNodeDefinition());
  addStencil(defaults, new ParallelogramNodeDefinition());
  addStencil(defaults, new TrapezoidNodeDefinition());
  addStencil(defaults, new DiamondNodeDefinition());
  addStencil(defaults, new HexagonNodeDefinition());
  addStencil(defaults, new TriangleNodeDefinition());
  addStencil(defaults, new ProcessNodeDefinition(), { size: { w: 100, h: 60 } });
  addStencil(defaults, new CylinderNodeDefinition());
  addStencil(defaults, new CurlyBracketNodeDefinition(), { size: { w: 35, h: 100 } });
  addStencil(defaults, new BlockArcNodeDefinition());
  addStencil(defaults, new ArcNodeDefinition());
  addStencil(defaults, new CloudNodeDefinition(), { size: { w: 100, h: 70 } });
  addStencil(defaults, new StepNodeDefinition());
  addStencil(defaults, new LineNodeDefinition());
  addStencil(defaults, new DelayNodeDefinition());
  addStencil(defaults, new DocumentNodeDefinition());
  addStencil(defaults, new CubeNodeDefinition());
  addStencil(defaults, new ContainerNodeDefinition());

  // Arrow stencils
  addStencil(arrows, new ArrowNodeDefinition('arrow-right', 'Arrow Right', 0));
  addStencil(arrows, new ArrowNodeDefinition('arrow-up', 'Arrow Up', -Math.PI / 2));
  addStencil(arrows, new ArrowNodeDefinition('arrow-down', 'Arrow Down', Math.PI / 2));
  addStencil(arrows, new ArrowNodeDefinition('arrow-left', 'Arrow Left', Math.PI));

  defaults.stencils.push(...loadStencilsFromYaml(stencils));

  // Edges
  addStencil(arrows, new BlockArrowEdgeDefinition());

  stencilRegistry.register(defaults);
  stencilRegistry.register(arrows);
  return stencilRegistry;
};

export const defaultRegistry = (lazyLoaders: Array<LazyElementLoaderEntry> = []) => ({
  nodes: defaultNodeRegistry(lazyLoaders),
  edges: defaultEdgeRegistry(lazyLoaders),
  stencils: defaultStencilRegistry()
});
