import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import { ContextMenuTarget } from '../../react-canvas-editor/EditableCanvas.tsx';

export const EdgeContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem
        action={'WAYPOINT_ADD'}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        context={{ point: props.target.pos, id: (props.target as any)['id'] }}
      >
        Add waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_DELETE'}
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        context={{ point: props.target.pos, id: (props.target as any)['id'] }}
      >
        Delete waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'EDGE_FLIP'}>Flip edge</ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget;
};
