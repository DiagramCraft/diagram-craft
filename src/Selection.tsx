import {Coord, SelectionState} from "./types.ts";
import {forwardRef, useImperativeHandle, useState} from "react";

export type SelectionApi = {
  repaint: () => void;
};

export const Selection = forwardRef<SelectionApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  const wx = props.selection.x;
  const wy = props.selection.y;

  return <rect
    x={props.selection.x}
    y={props.selection.y}
    width={props.selection.w}
    height={props.selection.h}
    fill="transparent"
    style={{stroke: 'red', strokeWidth: '5'}}
    onMouseDown={e => {
      const x = e.nativeEvent.offsetX - wx;
      const y = e.nativeEvent.offsetY - wy;
      props.onMouseDown({ x, y });
      e.stopPropagation();
    }}
  />
});

type Props = {
  selection: SelectionState
  onMouseDown: (c: Coord) => void
}