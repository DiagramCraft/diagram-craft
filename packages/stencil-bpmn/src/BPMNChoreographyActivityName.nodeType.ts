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
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Data as BPMNChoreographyActivityData } from './BPMNChoreographyActivity.nodeType';
import { ICON_SIZE } from '@diagram-craft/stencil-bpmn/spacing';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';

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
    this.capabilities['children.allowed'] = true;
    this.capabilities['children.select-parent'] = false;
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ): void {
    node.diagram.moveElement(elements, uow, node.layer, { relation: 'on', element: node });
  }

  // We don't want to change children if resizing activity
  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    _newBounds: Box,
    _previousBounds: Box,
    uow: UnitOfWork
  ): void {
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
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

      if (parentData.loopType === 'parallel') {
        markers.center.push(getIcon(linesVerticalIcon));
      } else if (parentData.loopType === 'sequential') {
        markers.center.push(getIcon(linesHorizontalIcon));
      } else if (parentData.loopType === 'standard') {
        markers.center.push(getIcon(arrowBackUpIcon));
      }

      if (!parentProps?.expanded) {
        if (parentData?.type === 'sub-choreography') {
          markers.center.push(getIcon(squarePlusIcon));
        }
      }

      renderMarkers(props.node, markers, builder, {
        size: ICON_SIZE,
        bottomMargin: BOTTOM_MARGIN,
        spacing: ICON_MARGIN
      });

      builder.add(
        svg.g(
          {},
          ...props.node.children.map(child =>
            svg.g(
              { transform: Transforms.rotateBack(props.node.bounds) },
              renderElement(this, child, props)
            )
          )
        )
      );
    }
  };
}
