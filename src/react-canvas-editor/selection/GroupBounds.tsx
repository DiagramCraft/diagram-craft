import { SelectionState } from '../../model/selectionState.ts';

export const GroupBounds = (props: Props) => {
  const groups = props.selection.getParents();

  if (groups.size === 0) return null;

  return [...groups].map(g => {
    const bounds = g.bounds;
    return (
      <rect
        key={g.id}
        x={bounds.pos.x}
        y={bounds.pos.y}
        width={bounds.size.w}
        height={bounds.size.h}
        fill="none"
        strokeDasharray={'5,5'}
        stroke={'hsl(215, 63%, 70%)'}
      />
    );
  });
};

type Props = {
  selection: SelectionState;
};
