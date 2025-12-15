import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { Menu } from '@diagram-craft/app-components/Menu';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_PASTE'} arg={{ point: props.target.pos }}>
        Paste
      </ActionContextMenuItem>
      <Menu.Separator />
      <ActionContextMenuItem action={'UNDO'}>Undo</ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'}>Redo</ActionContextMenuItem>
      <Menu.Separator />
      <ActionContextMenuItem action={'COMMENT_ADD'}>Add Comment</ActionContextMenuItem>
      <Menu.Separator />
      <ActionContextMenuItem action={'SELECT_ALL'}>Select All</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_NODES'}>Select Nodes</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_EDGES'}>Select Edges</ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
