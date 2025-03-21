import { DiagramEdge, EdgePropsForEditing, EdgePropsForRendering } from './diagramEdge';
import {
  DiagramNode,
  DuplicationContext,
  NodePropsForEditing,
  NodePropsForRendering
} from './diagramNode';
import { AbstractElement } from './types';
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from './unitOfWork';
import { Layer } from './diagramLayer';
import { Diagram } from './diagram';
import { AttachmentConsumer } from './attachment';
import { DeepReadonly, FlatObject } from '@diagram-craft/utils/types';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { assert } from '@diagram-craft/utils/assert';

// eslint-disable-next-line
type Snapshot = any;

export type ElementPropsForEditing = EdgePropsForEditing | NodePropsForEditing;
export type ElementPropsForRendering = EdgePropsForRendering | NodePropsForRendering;

export interface DiagramElement extends AbstractElement, AttachmentConsumer {
  invalidate(uow: UnitOfWork): void;
  detach(uow: UnitOfWork): void;
  duplicate(ctx?: DuplicationContext, id?: string | undefined): DiagramElement;
  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild?: boolean): void;
  isLocked(): boolean;

  readonly bounds: Box;
  readonly layer: Layer;
  readonly diagram: Diagram;
  activeDiagram: Diagram;
  readonly parent?: DiagramNode;

  readonly name: string;
  readonly dataForTemplate: FlatObject;

  isHidden(): boolean;

  highlights: ReadonlyArray<string>;

  setBounds(bounds: Box, uow: UnitOfWork): void;

  /**
   * Includes stored props as well as props from currently applied stylesheet
   */
  editProps: ElementPropsForEditing;

  /**
   * Includes edit props plus defaults and any conditional styling props
   */
  renderProps: ElementPropsForRendering;

  /**
   * Only props that are stored in the element
   */
  storedProps: ElementProps;

  getPropsInfo<T extends PropPath<ElementProps>>(
    path: T
  ): PropertyInfo<PropPathValue<ElementProps, T>>;

  updateProps(callback: (props: NodeProps | EdgeProps) => void, uow: UnitOfWork): void;

  metadata: DeepReadonly<ElementMetadata>;
  updateMetadata(callback: (metaData: ElementMetadata) => void, uow: UnitOfWork): void;

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

declare global {
  interface AssertTypeExtensions {
    node: (e: DiagramElement) => asserts e is DiagramNode;
    edge: (e: DiagramElement) => asserts e is DiagramEdge;
  }
}

assert.node = (e: DiagramElement): asserts e is DiagramNode => assert.true(isNode(e), 'not node');
assert.edge = (e: DiagramElement): asserts e is DiagramEdge => assert.true(isEdge(e), 'not edge');
