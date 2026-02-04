import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { Context, OnDoubleClick, OnMouseDown } from '../context';
import { VNode } from '../component/vdom';
import type { NodeComponentProps } from './BaseNodeComponent';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { ShapeEdgeDefinition } from '../shape/shapeEdgeDefinition';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import type { EdgeComponentProps } from './BaseEdgeComponent';
import { Component } from '../component/component';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';

type Props = {
  context: Context;
  isReadOnly: boolean;
  childProps: {
    onMouseDown: OnMouseDown;
    onDoubleClick?: OnDoubleClick;
  };
};
export const renderElement = (
  component: Component<unknown>,
  child: DiagramElement,
  props: Props
): VNode => {
  const p: NodeComponentProps & EdgeComponentProps = {
    key: CanvasDomHelper.elementId(child),
    // @ts-expect-error - this is fine as child is either node or edge
    element: child,
    onDoubleClick: props.childProps.onDoubleClick,
    onMouseDown: props.childProps.onMouseDown,
    isReadOnly: props.isReadOnly,

    context: props.context
  };

  if (isNode(child)) {
    const nodeDefinition = child.getDefinition() as ShapeNodeDefinition;
    const nodeComponent = nodeDefinition.component;
    return component.subComponent(() => new nodeComponent(nodeDefinition), p);
  } else if (isEdge(child)) {
    const edgeDefinition = child.getDefinition() as ShapeEdgeDefinition;
    const edgeComponent = edgeDefinition.component;
    return component.subComponent(() => new edgeComponent(edgeDefinition), p);
  } else {
    VERIFY_NOT_REACHED();
  }
};

export const renderChildren = (component: Component<unknown>, node: DiagramNode, props: Props) => {
  return svg.g(
    {},
    ...node.children.map(child =>
      svg.g(
        { transform: Transforms.rotateBack(node.bounds) },
        renderElement(component, child, props)
      )
    )
  );
};
