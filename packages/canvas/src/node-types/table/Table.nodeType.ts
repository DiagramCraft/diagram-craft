import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../../components/BaseNodeComponent';
import { Component } from '../../component/component';
import type { VNode } from '../../component/vdom';
import { ShapeBuilder } from '../../shape/ShapeBuilder';
import { DRAG_DROP_MANAGER } from '../../dragDropManager';
import { TableDividerResizeDrag } from './tableDividerResizeDrag';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { assert } from '@diagram-craft/utils/assert';
import { Rotation, Transform, Translation } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { ShapeNodeDefinition } from '../../shape/shapeNodeDefinition';
import * as svg from '../../component/vdom-svg';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../../highlight';
import { renderChildren } from '../../components/renderElement';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import {
  assertTableCell,
  assertTableRow,
  getTableDividerBands,
  setBoundsAndTransformChildren,
  TableHelper
} from './tableUtils';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
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
    columns.forEach(assertTableCell);
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
  overlayComponent = TableResizeOverlayComponent;

  constructor() {
    super('table', 'Table', TableComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenSelectParent]: true,
      [NodeFlags.ChildrenCanConvertToContainer]: false
    });
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

    for (const row of rows) assertTableRow(row);

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
        setBoundsAndTransformChildren(
          c.cell,
          Transform.box(c.newLocalBounds!, ...transformForward),
          uow,
          { inTableSyncOperation: true }
        );
      }
    }

    // Only trigger parent.onChildChanged in case this node has indeed changed
    if (node.parent && !Box.isEqual(node.bounds, boundsBefore)) {
      assert.true(isNode(node.parent));
      uow.on('before', 'commit', `onChildChanged/${node.parent.id}`, () => {
        const parentDef = (node.parent! as DiagramNode).getDefinition();
        parentDef.onChildChanged(node.parent! as DiagramNode, uow);
      });
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.number(node, 'Padding', 'custom.table.gap', {
        unit: 'px'
      }),
      p.boolean(node, 'Title', 'custom.table.title'),
      p.number(node, 'Title Size', 'custom.table.titleSize', {
        unit: 'px'
      })
    ]);
  }
}

const TABLE_RESIZE_OVERLAY_BAND_SIZE = 5;

class TableResizeOverlayComponent extends Component<{ node: DiagramNode }> {
  #hoveredDivider: string | undefined;

  private renderDividerBand(
    table: DiagramNode,
    divider: ReturnType<typeof getTableDividerBands>[number]
  ) {
    return svg.rect({
      'class': 'svg-hover-overlay',
      'x': divider.bounds.x,
      'y': divider.bounds.y,
      'width': divider.bounds.w,
      'height': divider.bounds.h,
      'fill':
        this.#hoveredDivider === divider.id ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0)',
      'stroke': 'none',
      'cursor': divider.type === 'column' ? 'ew-resize' : 'ns-resize',
      'pointer-events': 'all',
      'on': {
        mouseover: () => {
          this.#hoveredDivider = divider.id;
          this.redraw();
        },
        mouseout: () => {
          this.#hoveredDivider = undefined;
          this.redraw();
        },
        mousedown: e => {
          if (e.button !== 0) return;

          DRAG_DROP_MANAGER.initiate(
            new TableDividerResizeDrag(
              table,
              divider.type,
              divider.index,
              table.diagram.viewBox.toDiagramPoint(EventHelper.point(e))
            )
          );
          e.stopPropagation();
        }
      }
    });
  }

  render(props: { node: DiagramNode }) {
    const table = props.node;
    const helper = new TableHelper(table);
    if (!helper.isTable()) return svg.g({});
    const selection = table.diagram.selection;
    if (selection.type !== 'single-node' || selection.nodes[0] !== table) return svg.g({});

    const rows = helper.getRowsSorted();
    if (rows.length === 0) return svg.g({});

    const dividerBands: VNode[] = [];
    for (const divider of getTableDividerBands(table, TABLE_RESIZE_OVERLAY_BAND_SIZE)) {
      dividerBands.push(this.renderDividerBand(table, divider));
    }

    return svg.g({}, ...dividerBands);
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

    builder.add(renderChildren(this, props.node, props));

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
