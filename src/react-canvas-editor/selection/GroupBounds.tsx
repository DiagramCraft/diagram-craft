import { SelectionState } from '../../model/selectionState.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';

// TODO: This can be rotated
export const GroupBounds = (props: Props) => {
  const groups = props.selection.getParents();
  return [...groups].map(g => (
    <rect
      transform={`rotate(${Angle.toDeg(g.bounds.rotation)} ${Box.center(g.bounds).x} ${
        Box.center(g.bounds).y
      })`}
      key={g.id}
      x={g.bounds.pos.x}
      y={g.bounds.pos.y}
      className={'svg-selection__group-bounds'}
      width={g.bounds.size.w}
      height={g.bounds.size.h}
    />
  ));
};

type Props = {
  selection: SelectionState;
};
