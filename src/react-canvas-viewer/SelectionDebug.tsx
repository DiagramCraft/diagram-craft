import { forwardRef, useImperativeHandle } from 'react';
import { useRedraw } from './useRedraw.tsx';
import { SelectionState } from '../model-editor/selectionState.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const SelectionDebug = forwardRef<SelectionApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  if (props.selection.isEmpty()) return null;

  return (
    <>
      {props.selection.magnets.map(g => (
        <line
          key={Math.random().toString()}
          x1={g.line.from.x}
          y1={g.line.from.y}
          x2={g.line.to.x}
          y2={g.line.to.y}
          strokeWidth={2}
          stroke={'green'}
        />
      ))}
    </>
  );
});

type Props = {
  selection: SelectionState;
};
