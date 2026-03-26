import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Point, _p } from '@diagram-craft/geometry/point';
import {
  CustomProperty,
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

type UmlPseudoStateVariant = 'initial' | 'terminate' | 'entry' | 'exit' | 'final';

const INNER_FINAL_CIRCLE_SCALE = 0.64;
const EXIT_CROSS_MARGIN = 0.26;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlPseudoState?: {
        variant?: UmlPseudoStateVariant;
      };
    }
  }
}

registerCustomNodeDefaults('umlPseudoState', {
  variant: 'initial' as UmlPseudoStateVariant
});

export class UMLPseudoStateNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlPseudoState', 'UML Pseudo State', UMLPseudoStateComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false
    });
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const variant = node.renderProps.custom.umlPseudoState.variant ?? 'initial';

    if (variant === 'terminate') {
      return new PathListBuilder()
        .withTransform(fromUnitLCS(node.bounds))
        .moveTo(_p(0, 0))
        .lineTo(_p(1, 1))
        .moveTo(_p(1, 0))
        .lineTo(_p(0, 1));
    }

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(0.5, 0))
      .arcTo(_p(1, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 1), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0, 0.5), 0.5, 0.5, 0, 0, 1)
      .arcTo(_p(0.5, 0), 0.5, 0.5, 0, 0, 1);
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'n', start: Point.of(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: 'e', start: Point.of(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: 's', start: Point.of(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: 'w', start: Point.of(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [
      CustomProperty.node.select(node, 'Variant', 'custom.umlPseudoState.variant', [
        { value: 'initial', label: 'Initial' },
        { value: 'terminate', label: 'Terminate' },
        { value: 'entry', label: 'Entry' },
        { value: 'exit', label: 'Exit' },
        { value: 'final', label: 'Final' }
      ])
    ]);
  }
}

class UMLPseudoStateComponent extends BaseNodeComponent<UMLPseudoStateNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const { node, nodeProps } = props;
    const bounds = node.bounds;
    const variant = nodeProps.custom.umlPseudoState.variant ?? 'initial';
    const boundary = this.def.getBoundingPathBuilder(node).getPaths();

    if (variant === 'initial') {
      builder.boundaryPath(boundary.all(), {
        ...nodeProps,
        fill: {
          ...nodeProps.fill,
          enabled: true,
          color: nodeProps.stroke.color
        }
      });
      return;
    }

    if (variant === 'terminate') {
      builder.noBoundaryNeeded();
      builder.add(
        svg.line({
          x1: bounds.x,
          y1: bounds.y,
          x2: bounds.x + bounds.w,
          y2: bounds.y + bounds.h,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
      builder.add(
        svg.line({
          x1: bounds.x + bounds.w,
          y1: bounds.y,
          x2: bounds.x,
          y2: bounds.y + bounds.h,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
      return;
    }

    builder.boundaryPath(boundary.all(), {
      ...nodeProps,
      fill: {
        ...nodeProps.fill,
        enabled: false
      }
    });

    if (variant === 'exit') {
      const x1 = bounds.x + bounds.w * EXIT_CROSS_MARGIN;
      const y1 = bounds.y + bounds.h * EXIT_CROSS_MARGIN;
      const x2 = bounds.x + bounds.w * (1 - EXIT_CROSS_MARGIN);
      const y2 = bounds.y + bounds.h * (1 - EXIT_CROSS_MARGIN);

      builder.add(
        svg.line({
          x1,
          y1,
          x2,
          y2,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
      builder.add(
        svg.line({
          x1: x2,
          y1,
          x2: x1,
          y2,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
      return;
    }

    if (variant === 'final') {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const rx = (bounds.w * INNER_FINAL_CIRCLE_SCALE) / 2;
      const ry = (bounds.h * INNER_FINAL_CIRCLE_SCALE) / 2;

      builder.add(
        svg.ellipse({
          cx,
          cy,
          rx,
          ry,
          fill: nodeProps.stroke.color,
          stroke: nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
    }
  }
}
