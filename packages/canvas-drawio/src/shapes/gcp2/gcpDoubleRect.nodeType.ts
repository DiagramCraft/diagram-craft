import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { cloneAsWriteable } from '@diagram-craft/utils/object';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';

const NOTCH = 8;

const getNotch = (def: DiagramNode) => {
  return { offsetW: NOTCH / def.bounds.w, offsetH: NOTCH / def.bounds.h };
};

export class GCPDoubleRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.gcp2.doubleRect', 'GCP Double Rect', GCPDoubleRectNodeDefinition.Shape);
    this.setFlags({ [NodeFlags.StyleRounding]: false });
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const { offsetW, offsetH } = getNotch(def);

    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(0, 0))
      .lineTo(_p(1 - offsetW, 0))
      .lineTo(_p(1 - offsetW, offsetH))
      .lineTo(_p(1, offsetH))
      .lineTo(_p(1, 1))
      .lineTo(_p(offsetW, 1))
      .lineTo(_p(offsetW, 1 - offsetH))
      .lineTo(_p(0, 1 - offsetH))
      .lineTo(_p(0, 0));
  }

  static Shape = class extends BaseNodeComponent<GCPDoubleRectNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const { offsetW, offsetH } = getNotch(props.node);

      // Draw additional shape details
      const pathBuilder = new PathListBuilder()
        .withTransform(fromUnitLCS(bounds))
        .moveTo(_p(offsetW, 1 - offsetH))
        .lineTo(_p(1 - offsetW, 1 - offsetH))
        .lineTo(_p(1 - offsetW, offsetH));

      const lineProps = cloneAsWriteable(props.nodeProps);
      lineProps.shadow.enabled = false;
      shapeBuilder.path(pathBuilder.getPaths().all(), lineProps);
    }
  };
}
