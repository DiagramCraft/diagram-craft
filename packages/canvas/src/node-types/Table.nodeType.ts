import { ContainerComponent, ContainerNodeDefinition } from './Container.nodeType';
import { BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';

export class TableNodeDefinition extends ContainerNodeDefinition {
  constructor() {
    super('table', 'Table', TableComponent);
  }

  protected doLayoutChildren(
    props: NonNullable<NodeProps['container']>,
    node: DiagramNode,
    uow: UnitOfWork
  ) {
    // Ensure all columns have the same width
    const children = node.children;
    const rows = children.filter(isNode);
    for (let i = 0; i < rows[0].children.length; i++) {
      const maxWidth = Math.max(...rows.map(row => row.children[i]?.bounds.w));
      if (isNaN(maxWidth)) continue;

      for (const row of rows) {
        const child = row.children[i];
        if (child && isNode(child)) {
          child.setBounds(
            {
              ...child.bounds,
              w: isNaN(maxWidth) ? 100 : maxWidth
            },
            uow
          );
        }
      }
    }

    super.doLayoutChildren(props, node, uow);
  }
}

export class TableRowNodeDefinition extends ContainerNodeDefinition {
  constructor() {
    super('tableRow', 'Table Row', ContainerComponent);
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    super.layoutChildren(node, uow);

    const props = node.props.container ?? {};

    this.doLayoutChildren(
      {
        ...props,
        gap: node.parent?.propsForRendering.container.gap ?? 0,
        containerResize: 'both'
      },
      node,
      uow
    );
  }
}

class TableComponent extends ContainerComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    super.buildShape(props, builder);

    const gap = props.nodeProps.container?.gap ?? 0;

    const pathBuilder = new PathBuilder();
    PathBuilderHelper.rect(pathBuilder, props.node.bounds);

    const bounds = props.node.bounds;

    let x = bounds.x + gap;
    const row = props.node.children[0] as DiagramNode;
    for (let i = 0; i < row.children.length - 1; i++) {
      const child = row.children[i];
      if (isNode(child)) {
        x += child.bounds.w + gap;
        pathBuilder.moveTo(Point.of(x, bounds.y));
        pathBuilder.lineTo(Point.of(x, bounds.y + bounds.h));
      }
    }

    let y = bounds.y + gap;
    for (let i = 0; i < props.node.children.length - 1; i++) {
      const child = props.node.children[i];
      if (isNode(child)) {
        y += child.bounds.h + gap;
        pathBuilder.moveTo(Point.of(bounds.x, y));
        pathBuilder.lineTo(Point.of(bounds.x + bounds.w, y));
      }
    }

    builder.path(pathBuilder.getPaths().all(), {
      stroke: {
        enabled: true,
        color: 'red'
      },
      fill: {}
    });
  }
}
