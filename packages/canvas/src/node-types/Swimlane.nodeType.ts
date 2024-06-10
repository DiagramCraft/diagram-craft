import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { assert } from '@diagram-craft/utils/assert';
import { Rotation, Transform, Translation } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';

declare global {
  interface NodeProps {
    shapeSwimlane?: {
      horizontalBorder?: boolean;
      outerBorder?: boolean;
      title?: boolean;
      titleBorder?: boolean;
      titleSize?: number;
    };
  }
}

registerNodeDefaults('shapeSwimlane', {
  horizontalBorder: true,
  outerBorder: true,
  title: false,
  titleBorder: true,
  titleSize: 30
});

type RowsInOrder = Array<{
  row: DiagramNode;
  newLocalBounds?: Box;
  idx?: number;
}>;

const getRowsInOrder = (rows: DiagramNode[]): RowsInOrder => {
  const dest: RowsInOrder = [];

  for (const r of rows) {
    dest.push({ row: r, idx: 0 });
  }

  dest.sort((a, b) => a.row.bounds.y - b.row.bounds.y);

  return dest;
};

export class SwimlaneNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('swimlane', 'Swimlane', SwimlaneComponent);

    this.capabilities.fill = false;
    this.capabilities.children = true;
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    const nodeProps = node.renderProps;

    const transformBack = [
      // Rotation around center
      new Translation({
        x: -node.bounds.x - node.bounds.w / 2,
        y: -node.bounds.y - node.bounds.h / 2
      }),
      new Rotation(-node.bounds.r),
      // Move back to 0,0
      new Translation({
        x: node.bounds.w / 2,
        y: node.bounds.h / 2
      })
    ];
    const transformForward = transformBack.map(t => t.invert()).reverse();

    const children = node.children;
    const rows = getRowsInOrder(children.filter(isNode));

    // Assert all children are rows
    //    for (const row of rows) assert.true(row.nodeType === 'tableRow');

    const boundsBefore = node.bounds;

    const localBounds = Transform.box(node.bounds, ...transformBack);
    assert.true(Math.abs(localBounds.r) < 0.0001);

    let maxX = 0;
    const startY = nodeProps.shapeSwimlane.title ? nodeProps.shapeSwimlane.titleSize : 0;
    let y = startY;
    for (const row of rows) {
      let targetHeight = row.row.bounds.h;

      // TODO: Why is this needed
      if (isNaN(targetHeight) || !isFinite(targetHeight)) targetHeight = 100;

      row.newLocalBounds = {
        x: 0,
        w: row.row.bounds.w,
        y,
        h: targetHeight,
        r: 0
      };

      maxX = Math.max(row.row.bounds.w, maxX);
      y += targetHeight;
    }

    const newLocalBounds = {
      ...localBounds,
      h: y,
      w: maxX
    };

    // Transform back
    node.setBounds(Transform.box(newLocalBounds, ...transformForward), uow);
    for (const r of rows) {
      r.row.setBounds(Transform.box(r.newLocalBounds!, ...transformForward), uow);
    }

    // Only trigger parent.onChildChanged in case this node has indeed changed
    const mark = `parent-${node.id})`;
    if (node.parent && !Box.isEqual(node.bounds, boundsBefore) && !uow.hasMark(mark)) {
      uow.mark(mark);
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'title',
        type: 'boolean',
        label: 'Title',
        value: node.renderProps.shapeSwimlane.title,
        onChange: (value: boolean, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.shapeSwimlane ??= {};
            props.shapeSwimlane.title = value;
          }, uow);
        }
      },
      {
        id: 'titleSize',
        type: 'number',
        label: 'Title Size',
        unit: 'px',
        value: node.renderProps.shapeSwimlane.titleSize,
        onChange: (value: number, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.shapeSwimlane ??= {};
            props.shapeSwimlane.titleSize = value;
          }, uow);
        }
      }
    ];
  }
}

// TODO: Support fill (should be only for title)
class SwimlaneComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    const path = boundary.singularPath();
    const svgPath = path.asSvgPath();

    builder.add(
      svg.path({
        'd': svgPath,
        'x': props.node.bounds.x,
        'y': props.node.bounds.y,
        'width': props.node.bounds.w,
        'height': props.node.bounds.h,
        'stroke': props.nodeProps.highlight.includes('drop-target') ? '#30A46C' : '#d5d5d4',
        'stroke-width': props.nodeProps.highlight.includes('drop-target') ? 3 : 1,
        'fill': 'transparent',
        'on': {
          mousedown: props.onMouseDown,
          dblclick: builder.makeOnDblclickHandle('1')
        }
      })
    );

    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          this.makeElement(child, props)
        )
      );
    });

    const pathBuilder = new PathBuilder();

    if (props.nodeProps.shapeSwimlane.outerBorder !== false) {
      const nodeProps = props.nodeProps;
      PathBuilderHelper.rect(pathBuilder, {
        ...props.node.bounds,
        y:
          props.node.bounds.y +
          (nodeProps.shapeSwimlane.title ? nodeProps.shapeSwimlane.titleSize : 0),
        h:
          props.node.bounds.h -
          (nodeProps.shapeSwimlane.title ? nodeProps.shapeSwimlane.titleSize : 0)
      });
    }

    const bounds = props.node.bounds;

    let startY = bounds.y;
    if (props.nodeProps.shapeSwimlane.title) {
      const titleSize = props.nodeProps.shapeSwimlane.titleSize;
      builder.text(this, '1', props.nodeProps.text, {
        ...bounds,
        h: titleSize
      });

      startY += titleSize;
    }

    if (props.nodeProps.shapeSwimlane.horizontalBorder !== false) {
      let y = startY;
      const sortedChildren = props.node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      for (let i = 0; i < sortedChildren.length - 1; i++) {
        const child = sortedChildren[i];
        if (isNode(child)) {
          y += child.bounds.h;
          pathBuilder.moveTo(Point.of(bounds.x, y));
          pathBuilder.lineTo(Point.of(bounds.x + bounds.w, y));
        }
      }
    }

    if (props.nodeProps.shapeSwimlane.titleBorder !== false) {
      pathBuilder.moveTo(Point.of(bounds.x, startY));
      pathBuilder.lineTo(Point.of(bounds.x, bounds.y));
      pathBuilder.lineTo(Point.of(bounds.x + bounds.w, bounds.y));
      pathBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));
    }

    builder.path(pathBuilder.getPaths().all(), {
      stroke: !props.nodeProps.stroke.enabled
        ? { enabled: false, color: 'transparent' }
        : props.nodeProps.stroke,
      fill: {}
    });
  }
}
