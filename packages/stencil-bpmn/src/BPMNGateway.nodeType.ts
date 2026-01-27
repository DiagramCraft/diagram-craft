import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import {
  crossFilledIcon,
  crossIcon,
  medicalCrossFilledIcon,
  pentagonIcon,
  xFilledIcon
} from './icons/icons';
import {
  createBelowShapeTextBox,
  getIcon,
  Icon,
  RECTANGULAR_SHAPE_ANCHORS,
  renderIcon
} from '@diagram-craft/stencil-bpmn/utils';
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
    return RECTANGULAR_SHAPE_ANCHORS;
  }

  static Shape = class extends BaseNodeComponent<BPMNGatewayNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnGateway');
      return { type: 'default', ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const bounds = props.node.bounds;

      const boundary = new BPMNGatewayNodeDefinition()
        .getBoundingPathBuilder(props.node)
        .getPaths();

      shapeBuilder.boundaryPath(boundary.all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        createBelowShapeTextBox(bounds)
      );

      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;

      const data = this.getData(props.node);

      if (data.type === 'exclusive') {
        this.renderIcon(getIcon(xFilledIcon), props.node, shapeBuilder);
      } else if (data.type === 'inclusive') {
        const innerCircle = this.makeCircle(bounds, cx, cy, 0.55);

        shapeBuilder.path(innerCircle.getPaths().all(), undefined, {
          style: { fill: 'none', strokeWidth: '3' }
        });
      } else if (data.type === 'parallel') {
        this.renderIcon(getIcon(crossFilledIcon), props.node, shapeBuilder, 7);
      } else if (data.type === 'complex') {
        this.renderIcon(getIcon(medicalCrossFilledIcon), props.node, shapeBuilder, 7);
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
          this.renderIcon(getIcon(pentagonIcon), props.node, shapeBuilder, 14);
        } else if (data.type === 'event-based-start-process-inclusive') {
          this.renderIcon(getIcon(pentagonIcon), props.node, shapeBuilder, 14);
        } else {
          this.renderIcon(getIcon(crossIcon), props.node, shapeBuilder, 14);
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
      return renderIcon(icon, Box.grow(node.bounds, -shrink), node.renderProps, shapeBuilder);
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
