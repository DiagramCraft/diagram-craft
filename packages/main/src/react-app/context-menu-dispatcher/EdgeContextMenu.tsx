import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';
import * as ContextMenu from '@radix-ui/react-context-menu';

export const EdgeContextMenu = (props: Props) => {
  return (
    <>
      {/* TODO: Disable this when there's alreay a label */}
      <ActionContextMenuItem
        action={'EDGE_TEXT_ADD'}
        arg={{ point: props.target.pos, id: props.target['id'] }}
      >
        Add text
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_ADD'}
        arg={{ point: props.target.pos, id: props.target['id'] }}
      >
        Add waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem
        action={'WAYPOINT_DELETE'}
        arg={{ point: props.target.pos, id: props.target['id'] }}
      >
        Delete waypoint
      </ActionContextMenuItem>
      <ActionContextMenuItem action={'EDGE_FLIP'}>Flip edge</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'COMMENT_ADD'} arg={{ elementId: props.target.id }}>
        Add Comment
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'edge'>;
};
