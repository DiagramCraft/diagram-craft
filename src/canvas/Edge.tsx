import { forwardRef, useImperativeHandle } from 'react';
import { ResolvedEdgeDef } from '../model/diagram.ts';
import { Box } from '../geometry/geometry.ts';
import { useRedraw } from './useRedraw.tsx';

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

  return <line x1={sm.x} y1={sm.y} x2={em.x} y2={em.y} stroke={'black'} />;
});

type Props = {
  def: ResolvedEdgeDef;
};
