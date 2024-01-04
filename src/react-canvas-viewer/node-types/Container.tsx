import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Edge } from '../Edge.tsx';
import { Node } from '../Node.tsx';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { CustomPropertyDefinition, NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { Scale, Transform } from '../../geometry/transform.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { UndoableAction } from '../../model/undoManager.ts';

declare global {
  interface NodeProps {
    container?: {
      autoGrow?: boolean;
      layout?: 'manual' | 'horizontal' | 'vertical';
      gap?: number;
    };
  }
}

export const Container = (props: Props) => {
  const path = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  const center = Box.center(props.node.bounds);
  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.pos.x}
        y={props.node.bounds.pos.y}
        width={props.node.bounds.size.w}
        height={props.node.bounds.size.h}
        stroke={props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : '#d5d5d4'}
        strokeWidth={props.nodeProps.highlight?.includes('drop-target') ? 3 : 1}
        fill={'transparent'}
        {...propsUtils.filterSvgProperties(props, 'fill', 'stroke', 'strokeWidth', 'style')}
      />
      {props.node.children.map(child => (
        <g
          key={child.id}
          transform={`rotate(${-Angle.toDeg(props.node.bounds.rotation)} ${center.x} ${center.y})`}
        >
          {child.type === 'node' ? (
            <Node
              def={child}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick}
              onMouseDown={props.childProps.onMouseDown}
              onMouseLeave={props.childProps.onMouseLeave}
              onMouseEnter={props.childProps.onMouseEnter}
            />
          ) : (
            <Edge
              def={child}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
              onMouseDown={props.childProps.onMouseDown}
              onMouseLeave={props.childProps.onMouseLeave}
              onMouseEnter={props.childProps.onMouseEnter}
            />
          )}
        </g>
      ))}
    </>
  );
};

export class ContainerNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('container', 'Container');
  }

  supports(capability: NodeCapability): boolean {
    return ['children'].includes(capability);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork) {
    if (transforms.find(t => t instanceof Scale)) return;
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      autoGrow: {
        type: 'boolean',
        label: 'Grow',
        value: node.props.container?.autoGrow ?? false,
        onChange: (value: boolean) => {
          node.props.container ??= {};
          node.props.container.autoGrow = value;
        }
      },
      layout: {
        type: 'select',
        label: 'Layout',
        value: node.props.container?.layout ?? 'manual',
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' }
        ],
        onChange: (value: string) => {
          node.props.container ??= {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node.props.container.layout = value as any;
        }
      },
      gap: {
        type: 'number',
        label: 'Gap',
        value: node.props.container?.gap ?? 0,
        unit: 'px',
        onChange: (value: number) => {
          node.props.container ??= {};
          node.props.container.gap = value;
        }
      }
    };
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    _uow: UnitOfWork,
    _operation: string
  ): UndoableAction | undefined {
    node.diagram.moveElement(elements, node.layer, {
      relation: 'on',
      element: node
    });

    // TODO: Need to return undoable action here
    return undefined;
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    if (uow.changeType === 'interactive') return;

    this.applyLayout(node, uow);
  }

  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void {
    this.applyLayout(node, uow);
  }

  private applyLayout(node: DiagramNode, uow: UnitOfWork) {
    let newBounds: Box;
    if (node.props.container?.layout === 'horizontal') {
      // Sort children by x position
      const children = [...node.children].sort((a, b) => a.bounds.pos.x - b.bounds.pos.x);
      if (children.length === 0) return;

      // Layout horizontally
      let x = node.bounds.pos.x + (node.props.container.gap ?? 0);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type !== 'node') continue;

        this.updateBounds(
          child,
          {
            ...child.bounds,
            pos: Point.of(x, child.bounds.pos.y)
          },
          uow
        );
        x += child.bounds.size.w + (node.props.container.gap ?? 0);
      }

      newBounds = Box.boundingBox([
        {
          ...node.bounds,
          size: { w: x - node.bounds.pos.x, h: 1 }
        },
        ...children.map(c => c.bounds)
      ]);
    } else if (node.props.container?.layout === 'vertical') {
      // Sort children by y position
      const children = [...node.children].sort((a, b) => a.bounds.pos.y - b.bounds.pos.y);
      if (children.length === 0) return;

      // Layout verticall
      let y = node.bounds.pos.y + (node.props.container.gap ?? 0);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type !== 'node') continue;

        this.updateBounds(
          child,
          {
            ...child.bounds,
            pos: Point.of(child.bounds.pos.x, y)
          },
          uow
        );
        y += child.bounds.size.h + (node.props.container.gap ?? 0);
      }

      newBounds = Box.boundingBox([
        {
          ...node.bounds,
          size: { w: 1, h: y - node.bounds.pos.y }
        },
        ...children.map(c => c.bounds)
      ]);
    } else {
      if (!node.props.container?.autoGrow) return;

      const childrenBounds = node.children.map(c => c.bounds);
      if (childrenBounds.length === 0) return;
      newBounds = Box.boundingBox([node.bounds, ...childrenBounds]);
    }

    this.updateBounds(node, newBounds, uow);
    if (node.parent) {
      const parentDef = node.parent.getNodeDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }

  private updateBounds(node: DiagramNode, newBounds: Box, uow: UnitOfWork) {
    if (!Box.isEqual(newBounds, node.bounds)) {
      node.bounds = newBounds;
      uow.updateElement(node);
    }
  }
}

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onMouseEnter: (id: string) => void;
    onMouseLeave: (id: string) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
  };
} & Omit<
  React.SVGProps<SVGRectElement>,
  'onMouseEnter' | 'onMouseDown' | 'onMouseLeave' | 'onDoubleClick'
>;
