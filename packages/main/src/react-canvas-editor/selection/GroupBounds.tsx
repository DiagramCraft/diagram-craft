import { SelectionState } from '../../model/selectionState.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';

// TODO: This can be rotated
export const GroupBounds = (props: Props) => {
  const groups = props.selection.getParents();
  return [...groups].map(g => (
    <rect
      transform={`rotate(${Angle.toDeg(g.bounds.r)} ${Box.center(g.bounds).x} ${
        Box.center(g.bounds).y
      })`}
      key={g.id}
      x={g.bounds.x}
      y={g.bounds.y}
      className={'svg-selection__group-bounds'}
      width={g.bounds.w}
      height={g.bounds.h}
    />
  ));
};

type Props = {
  selection: SelectionState;
};
