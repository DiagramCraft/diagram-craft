import { ContainerComponent } from './Container.nodeType';
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

declare global {
  interface NodeProps {
    table?: {
      gap?: number;
      horizontalBorder?: boolean;
      verticalBorder?: boolean;
      outerBorder?: boolean;
    };
  }
}

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
    dest[i].idx = i;
    for (let j = 0; j < dest[i].columns.length; j++) {
      dest[i].columns[j].idx = j;
    }
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

    const nodeProps = node.propsForRendering;

    const gap = nodeProps.table?.gap ?? 10;

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
    let y = 0;
    for (const row of cellsInOrder) {
      let targetHeight = Math.max(...row.columns.map(c => c.cell.bounds.h));

      // TODO: Why is this needed
      if (isNaN(targetHeight) || !isFinite(targetHeight)) targetHeight = 100;

      // Layout row
      y += gap;

      // Layout columns in row
      let x = 0;
      for (const cell of row.columns) {
        const targetWidth = columnWidths[cell.idx!];

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
        id: 'gap',
        type: 'number',
        label: 'Padding',
        value: node.props.table?.gap ?? 10,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.table ??= {};
            props.table.gap = value;
          }, uow);
        }
      }
    ];
  }
}

class TableComponent extends ContainerComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    super.buildShape(props, builder);

    const gap = props.nodeProps.table?.gap ?? 10;

    const pathBuilder = new PathBuilder();

    if (props.nodeProps.table?.outerBorder !== false) {
      PathBuilderHelper.rect(pathBuilder, props.node.bounds);
    }

    const bounds = props.node.bounds;

    if (props.nodeProps.table?.verticalBorder !== false) {
      let x = bounds.x + gap;
      const row = props.node.children[0] as DiagramNode;
      for (let i = 0; i < row.children.length - 1; i++) {
        const child = row.children[i];
        if (isNode(child)) {
          x += child.bounds.w + gap;
          pathBuilder.moveTo(Point.of(x, bounds.y));
          pathBuilder.lineTo(Point.of(x, bounds.y + bounds.h));
          x += gap;
        }
      }
    }

    if (props.nodeProps.table?.horizontalBorder !== false) {
      let y = bounds.y + gap;
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
      stroke: !props.nodeProps.stroke?.enabled
        ? {
            enabled: false,
            color: 'transparent'
          }
        : props.nodeProps.stroke,
      fill: {}
    });
  }
}

export class TableRowNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('tableRow', 'Table Row', TableRowComponent);
    this.capabilities.fill = false;
    this.capabilities.select = false;
    this.capabilities.children = true;
  }

  layoutChildren(_node: DiagramNode, _uow: UnitOfWork) {
    // Do nothing
  }
}

class TableRowComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          this.makeElement(child, props)
        )
      );
    });
  }
}
