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
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const FORK_JOIN_RADIUS = 2.5;

export class UMLForkJoinNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlForkJoin', 'UML Fork / Join', UMLForkJoinComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false
    });
  }

  override onAdd(node: DiagramNode, diagram: DiagramNode['diagram'], uow: UnitOfWork) {
    super.onAdd(node, diagram, uow);
    node.updateProps(props => {
      props.capabilities ??= {};
      props.capabilities.resizable ??= {};
      props.capabilities.resizable.horizontal = false;
    }, uow);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      {
        id: 'left-edge',
        type: 'edge',
        start: _p(0, 0),
        end: _p(0, 1),
        normal: Math.PI,
        isPrimary: true
      },
      {
        id: 'right-edge',
        type: 'edge',
        start: _p(1, 0),
        end: _p(1, 1),
        normal: 0,
        isPrimary: true
      },
      { id: 'l', start: _p(0, 0.5), type: 'point', normal: Math.PI, isPrimary: true },
      { id: 'r', start: _p(1, 0.5), type: 'point', normal: 0, isPrimary: true }
    ];
  }

  getCustomPropertyDefinitions(_def: DiagramNode) {
    return new CustomPropertyDefinition(() => []);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = Math.min(FORK_JOIN_RADIUS, node.bounds.w / 2, node.bounds.h / 2);
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }
}

class UMLForkJoinComponent extends BaseNodeComponent<UMLForkJoinNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all(), {
      ...props.nodeProps,
      fill: {
        ...props.nodeProps.fill,
        enabled: true,
        color: props.nodeProps.stroke.color
      }
    });
  }
}
