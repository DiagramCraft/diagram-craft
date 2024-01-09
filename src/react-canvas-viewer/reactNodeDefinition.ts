import React from 'react';
import { PathBuilder } from '../geometry/pathBuilder.ts';
import { Path } from '../geometry/path.ts';
import { round } from '../utils/math.ts';
import { Box } from '../geometry/box.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import {
  CustomPropertyDefinition,
  NodeCapability,
  NodeDefinition
} from '../model/elementDefinitionRegistry.ts';
import { Extent } from '../geometry/extent.ts';
import { Diagram } from '../model/diagram.ts';
import { Point } from '../geometry/point.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { Transform } from '../geometry/transform.ts';
import { DiagramElement } from '../model/diagramElement.ts';
import { UndoableAction } from '../model/undoManager.ts';

type Props = {
  node: DiagramNode;
  nodeProps: NodeProps;
  def: NodeDefinition;
  diagram: Diagram;
  isSelected: boolean;
  isSingleSelected: boolean;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
  };
} & React.SVGProps<SVGRectElement>;

type ReactNode = React.FunctionComponent<Props>;

export abstract class AbstractReactNodeDefinition implements NodeDefinition {
  protected constructor(
    readonly type: string,
    readonly name: string
  ) {}

  supports(_capability: NodeCapability): boolean {
    return false;
  }

  abstract getBoundingPathBuilder(node: DiagramNode): PathBuilder;

  getBoundingPath(node: DiagramNode): Path {
    const bnd = node.bounds;

    const pb = this.getBoundingPathBuilder(node);
    if (round(bnd.r) !== 0) {
      pb.setRotation(bnd.r, Box.center(bnd));
    }
    return pb.getPath();
  }

  getCustomProperties(_node: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {};
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {};
  }

  getInitialConfig(): { size: Extent } {
    return { size: { w: 100, h: 100 } };
  }

  requestFocus(node: DiagramNode): void {
    const editable = document
      .getElementById(`text_1_${node.id}`)
      ?.getElementsByClassName('svg-node__text')
      .item(0) as HTMLDivElement | undefined | null;

    if (!editable) {
      return;
    }

    editable.contentEditable = 'true';
    editable.style.pointerEvents = 'auto';
    editable.focus();

    setTimeout(() => {
      document.execCommand('selectAll', false, undefined);
    }, 0);
  }

  onChildChanged(_node: DiagramNode, _uow: UnitOfWork): void {}
  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork): void {
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  onDrop(
    _coord: Point,
    _node: DiagramNode,
    _elements: ReadonlyArray<DiagramElement>,
    _uow: UnitOfWork,
    _operation: string
  ): UndoableAction | undefined {
    return undefined;
  }

  onPropUpdate(_node: DiagramNode, _uow: UnitOfWork): void {}
}

export class ReactNodeDefinition implements NodeDefinition {
  type: string;
  name: string;

  constructor(
    readonly reactNode: ReactNode,
    private readonly delegate: NodeDefinition
  ) {
    this.type = delegate.type;
    this.name = delegate.name;
  }

  supports(_capability: NodeCapability): boolean {
    return this.delegate.supports(_capability);
  }

  getBoundingPath(node: DiagramNode): Path {
    return this.delegate.getBoundingPath(node);
  }

  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition> {
    return this.delegate.getCustomProperties(node);
  }

  getDefaultProps(mode: 'picker' | 'canvas'): NodeProps {
    return this.delegate.getDefaultProps(mode);
  }

  getInitialConfig(): { size: Extent } {
    return this.delegate.getInitialConfig();
  }

  requestFocus(node: DiagramNode): void {
    return this.delegate.requestFocus(node);
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void {
    this.delegate.onChildChanged(node, uow);
  }

  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork): void {
    this.delegate.onTransform(transforms, node, uow);
  }

  onDrop(
    coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ): UndoableAction | undefined {
    return this.delegate.onDrop(coord, node, elements, uow, operation);
  }

  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void {
    return this.delegate.onPropUpdate(node, uow);
  }
}
