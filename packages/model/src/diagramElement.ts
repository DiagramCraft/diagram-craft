import { DiagramEdge } from './diagramEdge';
import { DiagramNode, DuplicationContext } from './diagramNode';
import { AbstractElement } from './types';
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from './unitOfWork';
import { Layer } from './diagramLayer';
import { Diagram } from './diagram';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';

// eslint-disable-next-line
type Snapshot = any;

export interface DiagramElement extends AbstractElement {
  invalidate(uow: UnitOfWork): void;
  detach(uow: UnitOfWork): void;
  duplicate(ctx?: DuplicationContext): DiagramElement;
  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild?: boolean): void;
  isLocked(): boolean;

  readonly bounds: Box;
  readonly layer: Layer;
  readonly diagram: Diagram;
  readonly parent?: DiagramNode;

  setBounds(bounds: Box, uow: UnitOfWork): void;

  props: DeepReadonly<NodeProps> | DeepReadonly<EdgeProps>;
  propsForEditing: DeepReadonly<NodeProps> | DeepReadonly<EdgeProps>;
  propsForRendering: DeepReadonly<DeepRequired<NodeProps>> | DeepReadonly<DeepRequired<EdgeProps>>;
  updateProps(callback: (props: NodeProps | EdgeProps) => void, uow: UnitOfWork): void;

  snapshot(): Snapshot;
  restore(snapshot: Snapshot, uow: UnitOfWork): void;

  _setLayer(layer: Layer, diagram: Diagram): void;
  _setParent(parent: DiagramNode | undefined): void;
}

export const getDiagramElementPath = (element: DiagramElement): DiagramNode[] => {
  const dest: DiagramNode[] = [];
  let current: DiagramNode | undefined = element.parent;
  while (current !== undefined) {
    dest.push(current);
    current = current.parent;
  }
  return dest;
};

export const getTopMostNode = (element: DiagramNode): DiagramNode => {
  const path = getDiagramElementPath(element);
  return path.length > 0 ? path[path.length - 1] : element;
};

export const isNode = (e: DiagramElement | undefined): e is DiagramNode => !!e && e.type === 'node';
export const isEdge = (e: DiagramElement | undefined): e is DiagramEdge => !!e && e.type === 'edge';
