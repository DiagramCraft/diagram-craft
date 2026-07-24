import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import { TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import type { Path } from '@diagram-craft/geometry/path';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { Releasable } from '@diagram-craft/utils/releasable';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { isDifferent, isSame } from '@diagram-craft/utils/math';
import {
  isHorizontal,
  isParallel,
  isPerpendicular,
  isReadable,
  isVertical,
  type LabelNode
} from './labelNode';
import type { UnitOfWork } from './unitOfWork';
import type { DiagramElement } from './diagramElement';
import type { DiagramEdge, DiagramEdgeCRDT, ResolvedLabelNode } from './diagramEdge';

export type LabelNodeCRDTEntry = { node: LabelNode & { nodeId: string } };

export const makeLabelNodeMapper = (
  edge: DiagramEdge
): CRDTMapper<ResolvedLabelNode, CRDTMap<LabelNodeCRDTEntry>> => {
  return {
    fromCRDT(e: CRDTMap<LabelNodeCRDTEntry>): ResolvedLabelNode {
      const node = e.get('node')!;
      return {
        ...node,
        node: () => mustExist(edge.diagram.nodeLookup.get(node.nodeId))
      };
    },

    toCRDT(e: ResolvedLabelNode): CRDTMap<LabelNodeCRDTEntry> {
      const m = edge.crdt.get().factory.makeMap<LabelNodeCRDTEntry>();
      m.set('node', {
        id: e.id,
        nodeId: e.node().id,
        offset: e.offset,
        offsetType: e.offsetType,
        type: e.type,
        timeOffset: e.timeOffset
      });
      return m;
    }
  };
};

/**
 * Owns the CRDT-backed label-node store for an edge: storage, the DEBUG-only
 * consistency invariant between label nodes and edge children, and placement of
 * label nodes along the edge's path.
 *
 * Syncing label nodes with the edge's child element tree stays on SimpleDiagramEdge,
 * since that requires reaching into AbstractDiagramElement's child management
 * (super.addChild, this.removeChild, layer.removeElement) which is core element-tree
 * orchestration, not something this store should depend on.
 */
export class EdgeLabels {
  readonly #labelNodesMap: WatchableValue<CRDTMap<MappedCRDTOrderedMapMapType<LabelNodeCRDTEntry>>>;
  readonly #labelNodes: MappedCRDTOrderedMap<ResolvedLabelNode, LabelNodeCRDTEntry>;

  constructor(edge: DiagramEdge, edgeCrdt: WatchableValue<CRDTMap<DiagramEdgeCRDT>>) {
    this.#labelNodesMap = WatchableValue.from(
      ([m]) => m.get().get('labelNodes', () => edge.diagram.document.root.factory.makeMap())!,
      [edgeCrdt]
    );

    this.#labelNodes = new MappedCRDTOrderedMap<ResolvedLabelNode, LabelNodeCRDTEntry>(
      this.#labelNodesMap,
      makeLabelNodeMapper(edge)
    );
  }

  get releasables(): ReadonlyArray<Releasable> {
    return [this.#labelNodes, this.#labelNodesMap];
  }

  get labelNodes(): ReadonlyArray<ResolvedLabelNode> {
    return this.#labelNodes.values;
  }

  get size(): number {
    return this.#labelNodes.size;
  }

  /** Replaces the full raw label-node list. Callers are responsible for keeping edge children in sync. */
  set(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined) {
    this.#labelNodes.set(labelNodes?.map(n => [n.id, n]) ?? []);
  }

  consistencyInvariant(children: ReadonlyArray<DiagramElement>) {
    DEBUG: {
      // Check that labelNodes and children have the same length
      assert.true(
        this.size === children.length,
        `Label nodes don't match children - different length; ${children.length} != ${this.size}`
      );

      // Check that labelNodes and children have the same nodes
      for (const ln of this.labelNodes) {
        assert.true(
          !!children.find(c => c.id === ln.node().id),
          `Label node doesn't match children - different ids; ${children.map(c => c.id).join(', ')} != ${this.labelNodes.map(ln => ln.node().id).join(', ')}`
        );
      }

      // Check that no children are elements of the layer
      for (const c of children) {
        assert.false(
          c.layer.type === 'regular' && !!c.layer.elements.find(e => e === c),
          "Label node doesn't match children - element"
        );
      }

      // Check that all children are part of the element mapping of the diagram
      for (const c of children) {
        assert.true(
          c.diagram.nodeLookup.has(c.id) || c.diagram.edgeLookup.has(c.id),
          "Label node doesn't match children - diagram"
        );
      }
    }
  }

  adjustPositions(path: Path, uow: UnitOfWork) {
    if (this.labelNodes.length === 0) return;

    for (const labelNode of this.labelNodes) {
      const pathD = TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: labelNode.timeOffset }, path);
      const attachmentPoint = path.pointAt(pathD);
      const labelNodeNode = labelNode.node();

      let hAlign = labelNodeNode.renderProps.text.align;
      let vAlign = labelNodeNode.renderProps.text.valign;

      let newReferencePoint = Point.add(attachmentPoint, labelNode.offset);
      if (labelNode.offsetType === 'relative') {
        const directionAtAttachmentPoint = Vector.normalize(path.tangentAt(pathD));
        const cross = Vector.tangentToNormal(directionAtAttachmentPoint);

        const absoluteOffset = Point.add(
          Vector.scale(directionAtAttachmentPoint, labelNode.offset.x),
          Vector.scale(cross, labelNode.offset.y)
        );
        newReferencePoint = Point.add(attachmentPoint, absoluteOffset);

        if (!isParallel(labelNode.type) && !isPerpendicular(labelNode.type)) {
          if (isSame(absoluteOffset.x, 0, 1)) hAlign = 'center';
          else if (absoluteOffset.x < 0) hAlign = 'right';
          else if (absoluteOffset.x > 0) hAlign = 'left';

          if (isSame(absoluteOffset.y, 0, 1)) vAlign = 'middle';
          else if (absoluteOffset.y < 0) vAlign = 'bottom';
          else if (absoluteOffset.y > 0) vAlign = 'top';
        }
      }

      let newRotation = labelNodeNode.bounds.r;
      if (isParallel(labelNode.type) || isPerpendicular(labelNode.type)) {
        const tangent = path.tangentAt(pathD);

        if (isParallel(labelNode.type)) {
          newRotation = Vector.angle(tangent);
        } else {
          newRotation = Vector.angle(tangent) + Math.PI / 2;
        }

        if (isReadable(labelNode.type)) {
          if (newRotation > Math.PI / 2) newRotation -= Math.PI;
          if (newRotation < -Math.PI / 2) newRotation += Math.PI;
        }

        newReferencePoint = Point.add(
          attachmentPoint,
          Point.rotate({ x: -labelNode.offset.x, y: 0 }, Vector.angle(tangent) + Math.PI / 2)
        );
      } else if (isHorizontal(labelNode.type)) {
        newRotation = 0;
      } else if (isVertical(labelNode.type)) {
        newRotation = Math.PI / 2;
      }

      const referenceOffsetFromMidpoint = Point.of(0, 0);
      if (hAlign === 'left') {
        referenceOffsetFromMidpoint.x = labelNodeNode.bounds.w / 2;
      } else if (hAlign === 'right') {
        referenceOffsetFromMidpoint.x = -labelNodeNode.bounds.w / 2;
      }

      if (vAlign === 'top') {
        referenceOffsetFromMidpoint.y =
          labelNodeNode.bounds.h / 2 + (labelNode.offsetType === 'relative' ? 0 : 6);
      } else if (vAlign === 'bottom') {
        referenceOffsetFromMidpoint.y =
          -labelNodeNode.bounds.h / 2 - (labelNode.offsetType === 'relative' ? 0 : 1);
      }

      // Note, using rounding here to avoid infinite recursion
      newReferencePoint = Point.add(newReferencePoint, referenceOffsetFromMidpoint);
      const currentReferencePoint = Point.add(
        Box.center(labelNodeNode.bounds),
        referenceOffsetFromMidpoint
      );
      const hasChanged =
        isDifferent(newReferencePoint.x, currentReferencePoint.x) ||
        isDifferent(newReferencePoint.y, currentReferencePoint.y) ||
        isDifferent(newRotation, labelNodeNode.bounds.r);

      if (hasChanged) {
        labelNodeNode.setBounds(
          {
            ...labelNodeNode.bounds,
            r: newRotation,
            x: newReferencePoint.x - labelNodeNode.bounds.w / 2,
            y: newReferencePoint.y - labelNodeNode.bounds.h / 2
          },
          uow
        );
      }
    }
  }
}
