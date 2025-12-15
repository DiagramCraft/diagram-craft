import { ActionMenuItem } from '../components/ActionMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { Menu } from '@diagram-craft/app-components/Menu';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionMenuItem action={'CLIPBOARD_PASTE'} arg={{ point: props.target.pos }}>
        Paste
      </ActionMenuItem>
      <Menu.Separator />
      <ActionMenuItem action={'UNDO'}>Undo</ActionMenuItem>
      <ActionMenuItem action={'REDO'}>Redo</ActionMenuItem>
      <Menu.Separator />
      <ActionMenuItem action={'COMMENT_ADD'}>Add Comment</ActionMenuItem>
      <Menu.Separator />
      <ActionMenuItem action={'SELECT_ALL'}>Select All</ActionMenuItem>
      <ActionMenuItem action={'SELECT_ALL_NODES'}>Select Nodes</ActionMenuItem>
      <ActionMenuItem action={'SELECT_ALL_EDGES'}>Select Edges</ActionMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
