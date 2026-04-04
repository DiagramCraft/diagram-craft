import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../../components/BaseNodeComponent';
import { ShapeBuilder } from '../../shape/ShapeBuilder';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Transform } from '@diagram-craft/geometry/transform';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { isNode } from '@diagram-craft/model/diagramElement';
import { TableHelper } from './tableUtils';
import { renderChildren } from '../../components/renderElement';
import { LayoutCapableShapeNodeDefinition } from '../../shape/layoutCapableShapeNodeDefinition';
import { setBoundsAndTransformChildren } from './tableUtils';

export class TableCellNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('tableCell', 'Table Cell', TableCellComponent);

    this.setFlags({
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCanConvertToContainer]: false,
      [NodeFlags.AnchorsVisibleOnHover]: false
    });
  }

  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    prevBounds: Box,
    uow: UnitOfWork
  ) {
    super.onTransform(transforms, node, newBounds, prevBounds, uow);
    syncTableCellDimensions(node, newBounds, prevBounds, uow);
  }
}

const syncTableCellDimensions = (
  node: DiagramNode,
  newBounds: Box,
  prevBounds: Box,
  uow: UnitOfWork
) => {
  if (uow.metadata.inTableSyncOperation) return;

  const helper = new TableHelper(node);
  if (!helper.isTable()) return;

  const row = helper.getCurrentRow();
  const colIdx = helper.getCellColumnIndex();

  if (newBounds.h !== prevBounds.h && row) {
    for (const sibling of helper.getColumnsSorted(row)) {
      if (sibling === node) continue;
      setBoundsAndTransformChildren(sibling, { ...sibling.bounds, h: newBounds.h }, uow, {
        inTableSyncOperation: true
      });
    }
  }

  if (newBounds.w !== prevBounds.w && colIdx !== undefined) {
    for (const siblingRow of helper.getRowsSorted()) {
      const sibling = helper.getColumnsSorted(siblingRow)[colIdx];
      if (!sibling || sibling === node) continue;
      setBoundsAndTransformChildren(sibling, { ...sibling.bounds, w: newBounds.w }, uow, {
        inTableSyncOperation: true
      });
    }
  }
};

class TableCellComponent extends BaseNodeComponent<TableCellNodeDefinition> {
  private onTableCellTextSizeChange(props: BaseShapeBuildShapeProps) {
    return (size: { w: number; h: number }) => {
      const { w: width, h: height } = size;
      const { bounds } = props.node;

      const shouldShrink = props.nodeProps.text.shrink;
      if (width > bounds.w || height > bounds.h || shouldShrink) {
        const newBounds = {
          x: bounds.x,
          y: bounds.y,
          r: bounds.r,
          h: shouldShrink ? height : Math.max(height, bounds.h),
          w: shouldShrink ? width : Math.max(width, bounds.w)
        };

        if (props.node.renderProps.text.align === 'center' && width > bounds.w) {
          newBounds.x = bounds.x - (width - bounds.w) / 2;
        }

        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.setBounds(newBounds, uow);
          syncTableCellDimensions(props.node, newBounds, bounds, uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        });
      }
    };
  }

  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(
      this,
      '1',
      props.node.getText(),
      props.nodeProps.text,
      props.node.bounds,
      this.onTableCellTextSizeChange(props)
    );
    shapeBuilder.add(renderChildren(this, props.node, props));
  }
}
