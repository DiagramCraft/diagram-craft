import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';

export const NodeContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'COMMENT_ADD'} arg={{ elementId: props.target.id }}>
        Add Comment
      </ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'node'>;
};
