import { forwardRef, useImperativeHandle, useState } from 'react';
import { ResolvedEdgeDef } from './diagram.ts';
import { Box } from './geometry.ts';

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  const startNode = props.def.start.node.val;
  const endNode = props.def.end.node.val;

  const sm = Box.center({ size: startNode.size, pos: startNode.world });
  const em = Box.center({ size: endNode.size, pos: endNode.world });

  return <line x1={sm.x} y1={sm.y} x2={em.x} y2={em.y} stroke={'black'} />;
});

type Props = {
  def: ResolvedEdgeDef;
};
