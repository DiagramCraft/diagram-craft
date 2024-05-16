import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildProps } from '../components/BaseNodeComponent';
import { NodeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { newid } from '@diagram-craft/utils/id';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Scale, Transform } from '@diagram-craft/geometry/transform';

type FlexShapeNodeDefinitionConfig = {
  isGroup: boolean;
  bounds: ShapeNodeDefinition;
};

declare global {
  interface NodeProps {
    shapeFlex?: {
      components?: Array<{
        nodeType: string;
        bounds: Box;
        behavior: {
          w: 'scale' | 'fixed';
          h: 'scale' | 'fixed';
          x: 'scale' | 'fixed' | 'center';
          y: 'scale' | 'fixed' | 'center';
        };
        props: NodeProps;
      }>;
    };
  }
}

export class FlexShapeNodeDefinition extends ShapeNodeDefinition {
  constructor(
    type: string,
    name: string,
    private readonly config: FlexShapeNodeDefinitionConfig
  ) {
    super(type, name, FlexShapeNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<FlexShapeNodeDefinition> {
    buildShape(props: BaseShapeBuildProps, builder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

      builder.add(
        svg.path({
          'd': boundary.asSvgPath(),
          'x': props.node.bounds.x,
          'y': props.node.bounds.y,
          'width': props.node.bounds.w,
          'height': props.node.bounds.h,
          'stroke': props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : '#d5d5d4',
          'stroke-width': props.nodeProps.highlight?.includes('drop-target') ? 3 : 1,
          'fill': 'transparent',
          'on': {
            mousedown: props.onMouseDown
          }
        })
      );

      builder.boundaryPath(boundary.all());
      builder.text(this);

      for (const cmp of props.nodeProps.shapeFlex!.components!) {
        const adjustedBounds = {
          x:
            cmp.behavior.x === 'scale'
              ? props.node.bounds.x + cmp.bounds.x * props.node.bounds.w
              : props.node.bounds.x + cmp.bounds.x,
          y:
            cmp.behavior.y === 'scale'
              ? props.node.bounds.y + cmp.bounds.y * props.node.bounds.h
              : props.node.bounds.y + cmp.bounds.y,
          w: cmp.behavior.w === 'scale' ? cmp.bounds.w * props.node.bounds.w : cmp.bounds.w,
          h: cmp.behavior.h === 'scale' ? cmp.bounds.h * props.node.bounds.h : cmp.bounds.h,
          r: 0
        };

        if (cmp.behavior.x === 'center') {
          adjustedBounds.x = props.node.bounds.x + props.node.bounds.w / 2 - adjustedBounds.w / 2;
        }

        if (cmp.behavior.y === 'center') {
          adjustedBounds.y = props.node.bounds.y + props.node.bounds.h / 2 - adjustedBounds.h / 2;
        }

        // Create a dummy node
        const node = new DiagramNode(
          newid(),
          cmp.nodeType,
          adjustedBounds,
          props.node.diagram,
          props.node.layer,
          cmp.props
        );

        builder.add(svg.g({}, this.makeElement(node, props)));
      }

      if (this.def.config.isGroup) {
        builder.add(
          svg.g(
            {},
            ...props.node.children.map(child =>
              svg.g(
                { transform: Transforms.rotateBack(props.node.bounds) },
                this.makeElement(child, props)
              )
            )
          )
        );
      }
    }
  };

  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork) {
    if (transforms.find(t => t instanceof Scale)) return;
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  supports(capability: NodeCapability): boolean {
    if (capability === 'children') return this.config.isGroup;
    return super.supports(capability);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    node.diagram.moveElement(elements, uow, node.layer, {
      relation: 'on',
      element: node
    });
  }

  getBoundingPathBuilder(node: DiagramNode): PathBuilder {
    return this.config.bounds.getBoundingPathBuilder(node);
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}
