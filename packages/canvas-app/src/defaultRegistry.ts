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
  registerStencil,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { HexagonNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Hexagon.nodeType';
import { TriangleNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Triangle.nodeType';
import { ProcessNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Process.nodeType';
import { ArrowNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Arrow.nodeType';
import { CylinderNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cylinder.nodeType';
import { CurlyBracketNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/CurlyBracket.nodeType';
import { BlockArcNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/BlockArc.nodeType';
import { CloudNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cloud.nodeType';
import { BlockArrowEdgeDefinition } from '@diagram-craft/canvas-nodes/edge-types/BlockArrow.edgeType';
import { SimpleEdgeDefinition } from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { StepNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Step.nodeType';
import { DelayNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Delay.nodeType';
import { PartialRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/PartialRect.nodeType';
import { CubeNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Cube.nodeType';
import { LineNodeDefinition } from '@diagram-craft/canvas/node-types/Line.nodeType';
import { TableNodeDefinition } from '@diagram-craft/canvas/node-types/Table.nodeType';
import { SwimlaneNodeDefinition } from '@diagram-craft/canvas/node-types/Swimlane.nodeType';
import { RoundedRectNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/RoundedRect.nodeType';
import stencils from './defaultStencils.yaml';
import { TableRowNodeDefinition } from '@diagram-craft/canvas/node-types/TableRow.nodeType';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { DocumentNodeDefinition } from '@diagram-craft/canvas-nodes/node-types/Document.nodeType';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';

export const defaultNodeRegistry = () => {
  const reg = new NodeDefinitionRegistry();

  const defaults: StencilPackage = { id: 'default', name: 'Default', stencils: [] };
  const arrows: StencilPackage = { id: 'arrow', name: 'Arrow', stencils: [] };

  reg.register(new GroupNodeDefinition());

  registerStencil(reg, defaults, new RectNodeDefinition());
  registerStencil(reg, defaults, new RoundedRectNodeDefinition(), {
    props: mode => ({
      custom: {
        roundedRect: {
          radius: mode === 'picker' ? 20 : 10
        }
      }
    })
  });
  registerStencil(reg, defaults, new CircleNodeDefinition());
  registerStencil(reg, defaults, new TextNodeDefinition(), {
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
  registerStencil(reg, defaults, new StarNodeDefinition());
  registerStencil(reg, defaults, new RegularPolygonNodeDefinition());
  registerStencil(reg, defaults, new ParallelogramNodeDefinition());
  registerStencil(reg, defaults, new TrapezoidNodeDefinition());
  registerStencil(reg, defaults, new DiamondNodeDefinition());
  registerStencil(reg, defaults, new HexagonNodeDefinition());
  registerStencil(reg, defaults, new TriangleNodeDefinition());
  registerStencil(reg, defaults, new ProcessNodeDefinition(), {
    size: { w: 100, h: 60 }
  });
  registerStencil(reg, defaults, new CylinderNodeDefinition());
  registerStencil(reg, defaults, new CurlyBracketNodeDefinition(), {
    size: { w: 35, h: 100 }
  });
  registerStencil(reg, defaults, new BlockArcNodeDefinition());
  registerStencil(reg, defaults, new CloudNodeDefinition(), {
    size: { w: 100, h: 70 }
  });
  registerStencil(reg, defaults, new StepNodeDefinition());
  registerStencil(reg, defaults, new LineNodeDefinition());
  registerStencil(reg, defaults, new DelayNodeDefinition());
  registerStencil(reg, defaults, new DocumentNodeDefinition());
  registerStencil(reg, defaults, new CubeNodeDefinition());
  registerStencil(reg, defaults, new ContainerNodeDefinition());

  // Arrow stencils
  registerStencil(reg, arrows, new ArrowNodeDefinition('arrow-right', 'Arrow Right', 0));
  registerStencil(reg, arrows, new ArrowNodeDefinition('arrow-up', 'Arrow Up', -Math.PI / 2));
  registerStencil(reg, arrows, new ArrowNodeDefinition('arrow-down', 'Arrow Down', Math.PI / 2));
  registerStencil(reg, arrows, new ArrowNodeDefinition('arrow-left', 'Arrow Left', Math.PI));

  // Hidden node definitions
  reg.register(new GenericPathNodeDefinition());
  reg.register(new PartialRectNodeDefinition());
  reg.register(new SwimlaneNodeDefinition());
  reg.register(new TableNodeDefinition());
  reg.register(new TableRowNodeDefinition());

  const stencilRegistry = reg.stencilRegistry;
  stencilRegistry.register(defaults);
  stencilRegistry.register(arrows, true);

  defaults.stencils.push(...loadStencilsFromYaml(stencils));

  return reg;
};

export const defaultEdgeRegistry = () => {
  const dest = new EdgeDefinitionRegistry();
  dest.defaultValue = new SimpleEdgeDefinition();
  dest.register(new BlockArrowEdgeDefinition());
  return dest;
};
