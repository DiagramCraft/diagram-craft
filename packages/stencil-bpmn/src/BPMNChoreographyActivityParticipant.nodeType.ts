import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import {
  arrowBackUpIcon,
  linesHorizontalIcon,
  linesVerticalIcon,
  squarePlusIcon
} from './icons/icons';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Data as BPMNChoreographyActivityData } from './BPMNChoreographyActivity.nodeType';
import { ICON_SIZE } from '@diagram-craft/stencil-bpmn/spacing';
import { renderIcon } from '@diagram-craft/stencil-bpmn/utils';

type ParticipantPosition = 'top' | 'middle' | 'bottom';
type LoopType = 'none' | 'standard' | 'sequential' | 'parallel';

type Data = {
  initiating?: boolean;
  loopType?: LoopType;
  multiple?: boolean;
};

const SCHEMA: DataSchema = {
  id: 'bpmnChoreographyActivityParticipant',
  name: 'BPMN Choreography Participant',
  providerId: 'default',
  fields: [
    {
      id: 'initiating',
      name: 'Initiating',
      type: 'boolean'
    },
    {
      id: 'loopType',
      name: 'Loop Type',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Standard', value: 'standard' },
        { label: 'Sequential', value: 'sequential' },
        { label: 'Parallel', value: 'parallel' }
      ]
    },
    {
      id: 'multiple',
      name: 'Multiple',
      type: 'boolean'
    }
  ]
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnChoreographyActivityParticipant?: {
        position?: ParticipantPosition;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnChoreographyActivityParticipant', {
  position: 'top'
});

// NodeDefinition and Shape *****************************************************

const ICON_MARGIN = 2;
const BOTTOM_MARGIN = 2;

export class BPMNChoreographyActivityParticipantNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyActivityParticipant',
      'BPMN Choreography Participant',
      BPMNChoreographyActivityParticipantNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyActivityParticipantNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(
        e => e.schema === 'bpmnChoreographyActivityParticipant'
      );
      return { ...(data?.data ?? {}) } as Data;
    }

    private getParentData(node: DiagramNode): BPMNChoreographyActivityData {
      const parent = node.parent;
      if (!isNode(parent)) return {};

      const data = parent.metadata.data?.data?.find(e => e.schema === 'bpmnChoreographyActivity');
      return { ...(data?.data ?? {}) } as BPMNChoreographyActivityData;
    }

    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());
      builder.text(this);

      const markers: Icon[] = [];

      const parent = props.node.parent;

      const data = this.getData(props.node);
      const parentData = this.getParentData(props.node);
      const parentProps =
        parent && isNode(parent)
          ? parent.renderProps.custom.bpmnChoreographyActivity
          : { expanded: false };

      if (props.nodeProps.custom.bpmnChoreographyActivityParticipant.position === 'middle') {
        if (!parentProps?.expanded) {
          if (data.loopType === 'parallel') {
            markers.push(getSVGIcon(linesVerticalIcon));
          } else if (data.loopType === 'sequential') {
            markers.push(getSVGIcon(linesHorizontalIcon));
          } else if (data.loopType === 'standard') {
            markers.push(getSVGIcon(arrowBackUpIcon));
          }

          if (parentData?.type === 'sub-choreography') {
            markers.push(getSVGIcon(squarePlusIcon));
          }
        }
      } else {
        if (data.multiple) {
          markers.push(getSVGIcon(linesVerticalIcon));
        }
      }

      if (markers.length > 0) {
        const width = markers.length * ICON_SIZE + (markers.length - 1) * ICON_MARGIN;
        const centerX = props.node.bounds.x + props.node.bounds.w / 2;

        let x = centerX - width / 2;
        for (const marker of markers) {
          const position = Box.fromCorners(
            _p(x, props.node.bounds.y + props.node.bounds.h - ICON_SIZE - BOTTOM_MARGIN),
            _p(x + ICON_SIZE, props.node.bounds.y + props.node.bounds.h - BOTTOM_MARGIN)
          );
          renderIcon(marker, position, props.nodeProps, builder);
          x += ICON_SIZE + ICON_MARGIN;
        }
      }
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const position = def.renderProps.custom.bpmnChoreographyActivityParticipant?.position ?? 'top';
    const radius = 5;
    const xr = radius / def.bounds.w;
    const yr = radius / def.bounds.h;

    if (position === 'top') {
      // Round top two corners only
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(xr, 0))
        .lineTo(_p(1 - xr, 0))
        .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
        .lineTo(_p(1, 1))
        .lineTo(_p(0, 1))
        .lineTo(_p(0, yr))
        .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
    } else if (position === 'bottom') {
      // Round bottom two corners only
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(0, 0))
        .lineTo(_p(1, 0))
        .lineTo(_p(1, 1 - yr))
        .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
        .lineTo(_p(xr, 1))
        .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
        .lineTo(_p(0, 0))
        .close();
    } else {
      // Middle position - no rounded corners
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(0, 0))
        .lineTo(_p(1, 0))
        .lineTo(_p(1, 1))
        .lineTo(_p(0, 1))
        .close();
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
      p.select(node, 'Position', 'custom.bpmnChoreographyActivityParticipant.position', [
        { value: 'top', label: 'Top' },
        { value: 'middle', label: 'Middle' },
        { value: 'bottom', label: 'Bottom' }
      ])
    ]);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
