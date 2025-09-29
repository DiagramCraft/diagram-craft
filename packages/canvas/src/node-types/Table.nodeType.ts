import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathListBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathListBuilder';
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
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { renderElement } from '../components/renderElement';

declare global {
  interface CustomNodeProps {
    table?: {
      gap?: number;
      horizontalBorder?: boolean;
      verticalBorder?: boolean;
      outerBorder?: boolean;
      title?: boolean;
      titleSize?: number;
    };
  }
}

registerCustomNodeDefaults('table', {
  gap: 0,
  horizontalBorder: true,
  verticalBorder: true,
  outerBorder: true,
  title: false,
  titleSize: 30
});

type CellsInOrder = Array<{
  row: DiagramNode;
  newLocalBounds?: Box;
  idx?: number;
  columns: Array<{
    cell: DiagramNode;
    newLocalBounds?: Box;
    idx?: number;
  }>;
}>;

const getCellsInOrder = (rows: DiagramNode[]): CellsInOrder => {
  const dest: CellsInOrder = [];

  for (const r of rows) {
    const columns = r.children.filter(isNode);
    const cells = columns.map(c => ({ cell: c, idx: 0 }));

    dest.push({ row: r, columns: cells, idx: 0 });
  }

  dest.sort((a, b) => a.row.bounds.y - b.row.bounds.y);

  for (let i = 0; i < dest.length; i++) {
    dest[i]!.idx = i;
    for (let j = 0; j < dest[i]!.columns.length; j++) {
      dest[i]!.columns[j]!.idx = j;
    }

    dest[i]!.columns.sort((a, b) => a.cell.bounds.x - b.cell.bounds.x);
  }

  return dest;
};

export class TableNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('table', 'Table', TableComponent);

    this.capabilities.fill = false;
    this.capabilities.children = true;
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    const nodeProps = node.renderProps;

    const gap = nodeProps.custom.table.gap;

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
    const rows = children.filter(isNode);

    // Assert all children are rows
    for (const row of rows) assert.true(row.nodeType === 'tableRow');

    const cellsInOrder = getCellsInOrder(rows);

    const boundsBefore = node.bounds;
    const localBounds = Transform.box(node.bounds, ...transformBack);
    assert.true(Math.abs(localBounds.r) < 0.0001);

    const columnWidths: number[] = [];
    for (const r of cellsInOrder) {
      for (const c of r.columns) {
        const width = c.cell.bounds.w;
        columnWidths[c.idx!] = Math.max(columnWidths[c.idx!] ?? 0, width);
      }
    }

    let maxX = 0;
    let y = nodeProps.custom.table.title ? nodeProps.custom.table.titleSize : 0;
    for (const row of cellsInOrder) {
      let targetHeight = Math.max(...row.columns.map(c => c.cell.bounds.h));

      // TODO: Why is this needed
      if (Number.isNaN(targetHeight) || !Number.isFinite(targetHeight)) targetHeight = 100;

      // Layout row
      y += gap;

      // Layout columns in row
      let x = 0;
      for (const cell of row.columns) {
        const targetWidth = columnWidths[cell.idx!]!;

        x += gap;
        cell.newLocalBounds = {
          x,
          w: targetWidth,
          y,
          h: targetHeight,
          r: 0
        };
        x += targetWidth;
        x += gap;
      }
      maxX = Math.max(x, maxX);

      row.newLocalBounds = {
        x: 0,
        w: x,
        y,
        h: targetHeight,
        r: 0
      };

      y += targetHeight;
      y += gap;
    }

    const newLocalBounds = {
      ...localBounds,
      h: y,
      w: maxX
    };

    // Transform back
    node.setBounds(Transform.box(newLocalBounds, ...transformForward), uow);
    for (const r of cellsInOrder) {
      r.row.setBounds(Transform.box(r.newLocalBounds!, ...transformForward), uow);
      for (const c of r.columns) {
        c.cell.setBounds(Transform.box(c.newLocalBounds!, ...transformForward), uow);
      }
    }

    // Only trigger parent.onChildChanged in case this node has indeed changed
    if (node.parent && !Box.isEqual(node.bounds, boundsBefore)) {
      assert.true(isNode(node.parent));
      uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
        const parentDef = (node.parent! as DiagramNode).getDefinition();
        parentDef.onChildChanged(node.parent! as DiagramNode, uow);
      });
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'gap',
        type: 'number',
        label: 'Padding',
        value: node.renderProps.custom.table.gap,
        unit: 'px',
        isSet: node.storedProps.custom?.table?.gap !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('table', props => (props.gap = value), uow);
        }
      },
      {
        id: 'title',
        type: 'boolean',
        label: 'Title',
        value: node.renderProps.custom.table.title,
        isSet: node.storedProps.custom?.table?.title !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('table', props => (props.title = value), uow);
        }
      },
      {
        id: 'titleSize',
        type: 'number',
        label: 'Title Size',
        unit: 'px',
        value: node.renderProps.custom.table.titleSize,
        isSet: node.storedProps.custom?.table?.titleSize !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('table', props => (props.titleSize = value), uow);
        }
      }
    ];
  }
}

class TableComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    const path = boundary.singular();
    const svgPath = path.asSvgPath();

    builder.noBoundaryNeeded();
    builder.add(
      svg.path({
        'd': svgPath,
        'x': props.node.bounds.x,
        'y': props.node.bounds.y,
        'width': props.node.bounds.w,
        'height': props.node.bounds.h,
        'stroke': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? '#30A46C' : '#d5d5d4',
        'stroke-width': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? 3 : 1,
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
          renderElement(this, child, props)
        )
      );
    });

    const gap = props.nodeProps.custom.table.gap;

    const pathBuilder = new PathListBuilder();

    if (props.nodeProps.custom.table.outerBorder !== false) {
      const nodeProps = props.nodeProps;
      PathBuilderHelper.rect(pathBuilder, {
        ...props.node.bounds,
        y:
          props.node.bounds.y +
          (nodeProps.custom.table.title ? nodeProps.custom.table.titleSize : 0),
        h:
          props.node.bounds.h -
          (nodeProps.custom.table.title ? nodeProps.custom.table.titleSize : 0)
      });
    }

    const bounds = props.node.bounds;

    let startY = bounds.y;
    let height = bounds.h;
    if (props.nodeProps.custom.table.title) {
      const titleSize = props.nodeProps.custom.table.titleSize;
      builder.text(this, '1', props.node.getText(), props.nodeProps.text, {
        ...bounds,
        h: titleSize
      });

      startY += titleSize;
      height -= titleSize;
    }

    if (props.nodeProps.custom.table.verticalBorder !== false) {
      let x = bounds.x + gap;
      const row = props.node.children[0] as DiagramNode;
      for (let i = 0; i < row.children.length - 1; i++) {
        const child = row.children[i];
        if (isNode(child)) {
          x += child.bounds.w + gap;
          pathBuilder.moveTo(Point.of(x, startY));
          pathBuilder.lineTo(Point.of(x, startY + height));
          x += gap;
        }
      }
    }

    if (props.nodeProps.custom.table.horizontalBorder !== false) {
      let y = startY + gap;
      const sortedChildren = props.node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      for (let i = 0; i < sortedChildren.length - 1; i++) {
        const child = sortedChildren[i];
        if (isNode(child)) {
          y += child.bounds.h + gap;
          pathBuilder.moveTo(Point.of(bounds.x, y));
          pathBuilder.lineTo(Point.of(bounds.x + bounds.w, y));
          y += gap;
        }
      }
    }

    builder.path(pathBuilder.getPaths().all(), {
      stroke: !props.nodeProps.stroke.enabled
        ? { enabled: false, color: 'transparent' }
        : props.nodeProps.stroke,
      fill: {}
    });
  }
}
