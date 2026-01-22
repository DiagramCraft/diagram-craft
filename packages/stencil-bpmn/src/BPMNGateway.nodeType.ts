import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import xFilledIcon from './icons/x-filled.svg?raw';
import pentagonIcon from './icons/pentagon.svg?raw';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import crossIcon from './icons/cross.svg?raw';
import crossFilledIcon from './icons/cross-filled.svg?raw';
import medicalCrossFilledIcon from './icons/medical-cross-filled.svg?raw';

type GatewayType =
  | 'default'
  | 'exclusive'
  | 'inclusive'
  | 'parallel'
  | 'complex'
  | 'event-based'
  | 'event-based-start-process-inclusive'
  | 'event-based-start-process-parallel';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnGateway?: {
        type?: GatewayType;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnGateway', {
  type: 'default'
});

export class BPMNGatewayNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnGateway', 'BPMN Gateway', BPMNGatewayNodeDefinition.Shape);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: _p(0.5, 0), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { start: _p(1, 0.5), id: '2', type: 'point', isPrimary: true, normal: 0 },
      { start: _p(0.5, 1), id: '3', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0, 0.5), id: '4', type: 'point', isPrimary: true, normal: Math.PI },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }

  static Shape = class extends BaseNodeComponent<BPMNGatewayNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = new BPMNGatewayNodeDefinition()
        .getBoundingPathBuilder(props.node)
        .getPaths();

      shapeBuilder.boundaryPath(boundary.all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(props.node.bounds.x - 50, props.node.bounds.y + props.node.bounds.h + 10),
          _p(
            props.node.bounds.x + props.node.bounds.w + 50,
            props.node.bounds.y + props.node.bounds.h + 20
          )
        )
      );

      const bounds = props.node.bounds;
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;

      const gatewayProps = props.nodeProps.custom.bpmnGateway;

      if (gatewayProps.type === 'exclusive') {
        this.renderIcon(getSVGIcon(xFilledIcon), props.node, shapeBuilder);
      } else if (gatewayProps.type === 'inclusive') {
        const innerCircle = this.makeCircle(bounds, cx, cy, 0.55);

        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none', strokeWidth: '3' }
        });
      } else if (gatewayProps.type === 'parallel') {
        this.renderIcon(getSVGIcon(crossFilledIcon), props.node, shapeBuilder, 7);
      } else if (gatewayProps.type === 'complex') {
        this.renderIcon(getSVGIcon(medicalCrossFilledIcon), props.node, shapeBuilder, 7);
      } else if (gatewayProps.type.startsWith('event-based')) {
        const innerCircle = this.makeCircle(bounds, cx, cy, 0.6);
        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none', strokeWidth: '1' }
        });

        if (gatewayProps.type === 'event-based') {
          const innerCircle = this.makeCircle(bounds, cx, cy, 0.5);
          shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
            style: { fill: 'none', strokeWidth: '1' }
          });
          this.renderIcon(getSVGIcon(pentagonIcon), props.node, shapeBuilder, 14);
        } else if (gatewayProps.type === 'event-based-start-process-inclusive') {
          this.renderIcon(getSVGIcon(pentagonIcon), props.node, shapeBuilder, 14);
        } else {
          this.renderIcon(getSVGIcon(crossIcon), props.node, shapeBuilder, 14);
        }
      }
    }

    private makeCircle(bounds: Box, cx: number, cy: number, innerRadius: number) {
      const rx = (bounds.w / 2) * innerRadius;
      const ry = (bounds.h / 2) * innerRadius;

      return new PathListBuilder()
        .moveTo({ x: cx + rx, y: cy })
        .arcTo({ x: cx - rx, y: cy }, rx, ry, 0, 0, 0)
        .arcTo({ x: cx + rx, y: cy }, rx, ry, 0, 0, 0)
        .close();
    }

    private renderIcon(icon: Icon, node: DiagramNode, shapeBuilder: ShapeBuilder, shrink = 10) {
      const nodeProps = node.renderProps;
      shapeBuilder.path(
        PathListBuilder.fromPathList(icon.pathList)
          .getPaths(TransformFactory.fromTo(icon.viewbox, Box.grow(node.bounds, -shrink)))
          .all(),
        undefined,
        {
          style: {
            fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
            stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none',
            strokeWidth: '1',
            strokeDasharray: 'none'
          }
        }
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathListBuilder().withTransform(fromUnitLCS(def.bounds));
    pathBuilder.moveTo(Point.of(0.5, 0));
    pathBuilder.lineTo(Point.of(1, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 1));
    pathBuilder.lineTo(Point.of(0, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 0));

    return pathBuilder;
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return [
      CustomProperty.node.select(def, 'Type', 'custom.bpmnGateway.type', [
        { value: 'default', label: 'Default' },
        { value: 'exclusive', label: 'Exclusive' },
        { value: 'inclusive', label: 'Inclusive' },
        { value: 'parallel', label: 'Parallel' },
        { value: 'complex', label: 'Complex' },
        { value: 'event-based', label: 'Event Based' },
        {
          value: 'event-based-start-process-inclusive',
          label: 'Event Based Start Process Inclusive'
        },
        {
          value: 'event-based-start-process-parallel',
          label: 'Event Based Start Process Parallel'
        }
      ])
    ];
  }
}
