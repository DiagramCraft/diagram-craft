import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point, _p } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';
import { Anchor } from '@diagram-craft/model/anchor';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

const DEFAULT_HEAD_W = 3;
const DEFAULT_HEAD_H = 8;
const SYMBOL_EDGE_INSET = 1;
const SIDE_MARGIN = 4;

type DurationConstraintAlignment = 'left' | 'center' | 'right';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlDurationConstraint?: {
        topLine?: boolean;
        bottomLine?: boolean;
        alignment?: DurationConstraintAlignment;
      };
    }
  }
}

registerCustomNodeDefaults('umlDurationConstraint', {
  topLine: false,
  bottomLine: false,
  alignment: 'center'
});

const buildDurationConstraintPath = (
  node: DiagramNode,
  opts: {
    topLine: boolean;
    bottomLine: boolean;
    alignment: DurationConstraintAlignment;
  }
) => {
  const { w, h } = node.bounds;
  const headHalfW = Math.min(DEFAULT_HEAD_W, w / 2);
  const headH = Math.min(DEFAULT_HEAD_H, h / 4);
  const topTipY = opts.topLine ? 0 : SYMBOL_EDGE_INSET;
  const bottomTipY = opts.bottomLine ? h : h - SYMBOL_EDGE_INSET;
  const centerX =
    opts.alignment === 'left'
      ? Math.max(headHalfW, SIDE_MARGIN)
      : opts.alignment === 'right'
        ? Math.min(w - headHalfW, w - SIDE_MARGIN)
        : w / 2;

  const builder = new PathListBuilder().withTransform([new Translation(node.bounds)]);

  if (opts.topLine) {
    builder.moveTo(Point.of(0, 0)).lineTo(Point.of(w, 0));
  }

  builder
    .moveTo(Point.of(centerX, topTipY))
    .lineTo(Point.of(centerX - headHalfW, topTipY + headH))
    .moveTo(Point.of(centerX, topTipY))
    .lineTo(Point.of(centerX + headHalfW, topTipY + headH))
    .moveTo(Point.of(centerX, topTipY))
    .lineTo(Point.of(centerX, bottomTipY))

    .moveTo(Point.of(centerX, bottomTipY))
    .lineTo(Point.of(centerX - headHalfW, bottomTipY - headH))

    .moveTo(Point.of(centerX, bottomTipY))
    .lineTo(Point.of(centerX + headHalfW, bottomTipY - headH));

  if (opts.bottomLine) {
    builder.moveTo(Point.of(0, h)).lineTo(Point.of(w, h));
  }

  return builder.getPaths();
};

export class UMLDurationConstraintNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlDurationConstraint', 'UML Duration Constraint', UMLDurationConstraintComponent);
    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false
    });
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'top', type: 'point', start: _p(0.5, 0), normal: -Math.PI / 2 },
      { id: 'bottom', type: 'point', start: _p(0.5, 1), normal: Math.PI / 2 },
      { id: 'c', type: 'center', start: _p(0.5, 0.5) }
    ];
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.select(def, 'Alignment', 'custom.umlDurationConstraint.alignment', [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
      ]),
      p.boolean(def, 'Top Line', 'custom.umlDurationConstraint.topLine'),
      p.boolean(def, 'Bottom Line', 'custom.umlDurationConstraint.bottomLine')
    ]);
  }
}

class UMLDurationConstraintComponent extends BaseNodeComponent<UMLDurationConstraintNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder): void {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all(), {
      ...props.nodeProps,
      fill: { ...props.nodeProps.fill, enabled: true, color: 'transparent' },
      stroke: { ...props.nodeProps.stroke, enabled: true, color: 'transparent' }
    } as NodeProps);

    shapeBuilder.path(
      buildDurationConstraintPath(props.node, {
        topLine: props.nodeProps.custom.umlDurationConstraint.topLine ?? false,
        bottomLine: props.nodeProps.custom.umlDurationConstraint.bottomLine ?? false,
        alignment: props.nodeProps.custom.umlDurationConstraint.alignment ?? 'center'
      }).all(),
      props.node.renderProps
    );

    shapeBuilder.text(this);
  }
}
