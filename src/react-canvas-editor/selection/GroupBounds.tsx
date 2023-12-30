import { SelectionState } from '../../model/selectionState.ts';

// TODO: This can be rotated
export const GroupBounds = (props: Props) => {
  const groups = props.selection.getParents();
  return [...groups].map(g => (
    <rect
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
