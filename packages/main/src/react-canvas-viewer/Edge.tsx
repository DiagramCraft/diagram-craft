import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { ApplicationTriggers } from '../react-canvas-editor/EditableCanvas.tsx';
import { DiagramEdge } from '../model/diagramEdge.ts';
import { Diagram } from '../model/diagram.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { useActions } from '../react-app/context/ActionsContext.ts';
import { Tool } from '../react-canvas-editor/tools/types.ts';
import { EdgeComponent, EdgeComponentProps } from './EdgeComponent.temp.ts';

export type EdgeApi = {
  repaint: () => void;
};

const useEdgeComponent = (component: () => EdgeComponent, props: EdgeComponentProps) => {
  const cmpRef = useRef<EdgeComponent>(component());
  const parentRef = useRef<SVGGElement>(null);

  if (parentRef.current) {
    setTimeout(() => {
      cmpRef.current.update(props);
    }, 0);
  }

  useEffect(() => {
    if (cmpRef.current.isRendered()) return;
    cmpRef.current.attach(parentRef.current!, props);
  });

  return parentRef;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const { actionMap } = useActions();

  const edgeRef = useEdgeComponent(() => new EdgeComponent(), { ...props, actionMap: actionMap });

  const redraw = useRedraw();
  useImperativeHandle(ref, () => ({ repaint: redraw }));

  return <g id={`edge-${props.def.id}`} ref={edgeRef} />;
});

type Props = {
  def: DiagramEdge;
  diagram: Diagram;
  tool: Tool | undefined;
  applicationTriggers: ApplicationTriggers;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick: (id: string, coord: Point) => void;
};
