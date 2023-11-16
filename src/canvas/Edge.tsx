import { forwardRef, MouseEventHandler, useCallback, useImperativeHandle } from 'react';
import { DiagramEdge } from '../model-viewer/diagram.ts';
import { Box } from '../geometry/box.ts';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { Modifiers } from './drag.ts';

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  const startNode = props.def.start.node;
  const endNode = props.def.end.node;

  const sm = Box.center(startNode.bounds);
  const em = Box.center(endNode.bounds);

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      props.onMouseDown(props.def.id, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  return (
    <>
      <line
        x1={sm.x}
        y1={sm.y}
        x2={em.x}
        y2={em.y}
        stroke={'pink'}
        strokeWidth={10}
        onMouseDown={onMouseDown}
      />
      <line x1={sm.x} y1={sm.y} x2={em.x} y2={em.y} stroke={'black'} />
    </>
  );
});

type Props = {
  def: DiagramEdge;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
};
