import { forwardRef, useImperativeHandle } from 'react';
import { ResolvedEdgeDef } from './diagram.ts';
import { Box } from './geometry.ts';
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

  const sm = Box.center(startNode);
  const em = Box.center(endNode);

  return <line x1={sm.x} y1={sm.y} x2={em.x} y2={em.y} stroke={'black'} />;
});

type Props = {
  def: ResolvedEdgeDef;
};
