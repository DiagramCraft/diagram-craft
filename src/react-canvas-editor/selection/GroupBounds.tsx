import { SelectionState } from '../../model/selectionState.ts';
import { DiagramElement, DiagramNode } from '../../model/diagramNode.ts';

const getParents = (node: DiagramElement): DiagramNode[] => {
  const parents: DiagramNode[] = [];
  let parent = node.parent;
  while (parent) {
    parents.push(parent);
    parent = parent.parent;
  }
  return parents;
};

export const GroupBounds = (props: Props) => {
  const groups = new Set<DiagramNode>();

  for (const e of props.selection.elements) {
    if (e.parent) getParents(e).forEach(p => groups.add(p));
  }

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
