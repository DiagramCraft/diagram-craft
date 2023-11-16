import { forwardRef, MouseEventHandler, useCallback, useImperativeHandle } from 'react';
import { DiagramEdge, isConnectedEndpoint } from '../model-viewer/diagram.ts';
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

  const start = props.def.start;
  const end = props.def.end;

  const sm = isConnectedEndpoint(start) ? Box.center(start.node.bounds) : start.position;
  const em = isConnectedEndpoint(end) ? Box.center(end.node.bounds) : end.position;

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
        stroke={'transparent'}
        strokeWidth={15}
        onMouseDown={onMouseDown}
        style={{ cursor: 'move' }}
      />
      <line
        x1={sm.x}
        y1={sm.y}
        x2={em.x}
        y2={em.y}
        stroke={'black'}
        onMouseDown={onMouseDown}
        style={{ cursor: 'move' }}
      />
    </>
  );
});

type Props = {
  def: DiagramEdge;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
};
