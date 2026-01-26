import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import xFilledIcon from './icons/x-filled.svg?raw';
import pentagonIcon from './icons/pentagon.svg?raw';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import crossIcon from './icons/cross.svg?raw';
import crossFilledIcon from './icons/cross-filled.svg?raw';
import medicalCrossFilledIcon from './icons/medical-cross-filled.svg?raw';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';

type GatewayType =
  | 'default'
  | 'exclusive'
  | 'inclusive'
  | 'parallel'
  | 'complex'
  | 'event-based'
  | 'event-based-start-process-inclusive'
  | 'event-based-start-process-parallel';

type Data = {
  type: GatewayType;
};

const SCHEMA: DataSchema = {
  id: 'bpmnGateway',
  name: 'BPMN Gateway',
  providerId: 'default',
  fields: [
    {
      id: 'name',
      name: 'Name',
      type: 'text'
    },
    {
      id: 'type',
      name: 'Type',
      type: 'select',
      options: [
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
      ]
    }
  ]
};

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
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnGateway');
      return { type: 'default', ...(data?.data ?? {}) } as Data;
    }

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

      const data = this.getData(props.node);

      if (data.type === 'exclusive') {
        this.renderIcon(getSVGIcon(xFilledIcon), props.node, shapeBuilder);
      } else if (data.type === 'inclusive') {
        const innerCircle = this.makeCircle(bounds, cx, cy, 0.55);

        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none', strokeWidth: '3' }
        });
      } else if (data.type === 'parallel') {
        this.renderIcon(getSVGIcon(crossFilledIcon), props.node, shapeBuilder, 7);
      } else if (data.type === 'complex') {
        this.renderIcon(getSVGIcon(medicalCrossFilledIcon), props.node, shapeBuilder, 7);
      } else if (data.type.startsWith('event-based')) {
        const innerCircle = this.makeCircle(bounds, cx, cy, 0.6);
        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none', strokeWidth: '1' }
        });

        if (data.type === 'event-based') {
          const innerCircle = this.makeCircle(bounds, cx, cy, 0.5);
          shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
            style: { fill: 'none', strokeWidth: '1' }
          });
          this.renderIcon(getSVGIcon(pentagonIcon), props.node, shapeBuilder, 14);
        } else if (data.type === 'event-based-start-process-inclusive') {
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
    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(0.5, 0)
      .lineTo(1, 0.5)
      .lineTo(0.5, 1)
      .lineTo(0, 0.5)
      .close();
  }

  getCustomPropertyDefinitions(_node: DiagramNode) {
    const def = new CustomPropertyDefinition(() => []);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
