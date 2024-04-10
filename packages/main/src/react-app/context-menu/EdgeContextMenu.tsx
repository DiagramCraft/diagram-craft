import { ActionContextMenuItem } from './ActionContextMenuItem';
import { ContextMenuTarget } from '../../App';

export const EdgeContextMenu = (props: Props) => {
  return (
    <>
      {/* TODO: Disable this when there's alreay a label */}
      <ActionContextMenuItem
        action={'EDGE_TEXT_ADD'}
        context={{ point: props.target.pos, id: props.target['id'] }}
      >
        Add text
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_ADD'}
        context={{ point: props.target.pos, id: props.target['id'] }}
      >
        Add waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_DELETE'}
        context={{ point: props.target.pos, id: props.target['id'] }}
      >
        Delete waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'EDGE_FLIP'}>Flip edge</ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget & { type: 'edge' };
};
