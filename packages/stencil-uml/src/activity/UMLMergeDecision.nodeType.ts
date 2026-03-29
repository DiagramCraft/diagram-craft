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
import {
  CustomProperty,
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';

const propDoubleBorder = (node: DiagramNode) =>
  CustomProperty.node.boolean(node, 'Double Border', 'custom.diamond.doubleBorder');

const propDoubleBorderGap = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Double Border Gap', 'custom.diamond.doubleBorderGap', {
    minValue: 1,
    maxValue: 50,
    unit: 'px'
  });

export class UMLMergeDecisionNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlMergeDecision', 'UML Merge / Decision', UMLMergeDecisionComponent);

    this.setFlags({
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false
    });
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(0.5, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(0.5, 1))
      .lineTo(_p(0, 0.5))
      .lineTo(_p(0.5, 0));
  }

  getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'n', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: 'e', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: 's', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: 'w', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [propDoubleBorder(node), propDoubleBorderGap(node)]);
  }
}

class UMLMergeDecisionComponent extends BaseNodeComponent<UMLMergeDecisionNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());

    const doubleBorder = props.nodeProps.custom.diamond.doubleBorder;
    if (doubleBorder) {
      const gap = props.nodeProps.custom.diamond.doubleBorderGap;
      const bounds = props.node.bounds;
      const w = bounds.w;
      const h = bounds.h;
      const d = (w * h) / (2 * Math.sqrt(w * w + h * h));
      const scale = Math.max(0, (d - gap) / d);

      const innerW = w * scale;
      const innerH = h * scale;
      const cx = bounds.x + w / 2;
      const cy = bounds.y + h / 2;

      const innerBounds = {
        x: cx - innerW / 2,
        y: cy - innerH / 2,
        w: innerW,
        h: innerH,
        r: bounds.r
      };

      const innerDiamond = new PathListBuilder()
        .withTransform(fromUnitLCS(innerBounds))
        .moveTo(_p(0.5, 0))
        .lineTo(_p(1, 0.5))
        .lineTo(_p(0.5, 1))
        .lineTo(_p(0, 0.5))
        .lineTo(_p(0.5, 0))
        .close();

      shapeBuilder.path(innerDiamond.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }

    shapeBuilder.text(this);
  }
}
