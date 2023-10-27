import { forwardRef, useImperativeHandle, useState } from 'react';
import { ResolvedEdgeDef } from './diagram.ts';

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

  return (
    <line
      x1={props.def.start.node.val.world.x + props.def.start.node.val.w / 2}
      y1={props.def.start.node.val.world.y + props.def.start.node.val.h / 2}
      x2={props.def.end.node.val.world.x + props.def.end.node.val.w / 2}
      y2={props.def.end.node.val.world.y + props.def.end.node.val.h / 2}
      stroke={'black'}
    />
  );
});

type Props = {
  def: ResolvedEdgeDef;
};
