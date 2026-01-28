import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { getIcon, Markers, renderMarkers } from '@diagram-craft/stencil-bpmn/utils';
import {
  arrowBackUpIcon,
  linesHorizontalIcon,
  linesVerticalIcon,
  squarePlusIcon
} from './icons/icons';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Data as BPMNChoreographyActivityData } from './BPMNChoreographyActivity.nodeType';
import { ICON_SIZE } from '@diagram-craft/stencil-bpmn/spacing';

// NodeDefinition and Shape *****************************************************

const ICON_MARGIN = 2;
const BOTTOM_MARGIN = 2;

export class BPMNChoreographyActivityNameNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyActivityName',
      'BPMN Choreography Name',
      BPMNChoreographyActivityNameNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyActivityNameNodeDefinition> {
    private getParentData(node: DiagramNode): BPMNChoreographyActivityData {
      const parent = node.parent;
      if (!isNode(parent)) return {};

      const data = parent.metadata.data?.data?.find(e => e.schema === 'bpmnChoreographyActivity');
      return { ...(data?.data ?? {}) } as BPMNChoreographyActivityData;
    }

    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());
      builder.text(this);

      const parent = props.node.parent;

      const parentData = this.getParentData(props.node);
      const parentProps =
        parent && isNode(parent)
          ? parent.renderProps.custom.bpmnChoreographyActivity
          : { expanded: false };

      const markers: Markers = { left: [], center: [], right: [] };

      if (!parentProps?.expanded) {
        if (parentData.loopType === 'parallel') {
          markers.center.push(getIcon(linesVerticalIcon));
        } else if (parentData.loopType === 'sequential') {
          markers.center.push(getIcon(linesHorizontalIcon));
        } else if (parentData.loopType === 'standard') {
          markers.center.push(getIcon(arrowBackUpIcon));
        }

        if (parentData?.type === 'sub-choreography') {
          markers.center.push(getIcon(squarePlusIcon));
        }
      }

      renderMarkers(props.node, markers, builder, {
        size: ICON_SIZE,
        bottomMargin: BOTTOM_MARGIN,
        spacing: ICON_MARGIN
      });
    }
  };
}
