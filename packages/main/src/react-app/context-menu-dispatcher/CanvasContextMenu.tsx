import { ActionMenuItem } from '../components/ActionMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { Menu } from '@diagram-craft/app-components/Menu';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionMenuItem action={'CLIPBOARD_PASTE'} arg={{ point: props.target.pos }} />
      <Menu.Separator />
      <ActionMenuItem action={'UNDO'} />
      <ActionMenuItem action={'REDO'} />
      <Menu.Separator />
      <ActionMenuItem action={'COMMENT_ADD'} />
      <Menu.Separator />
      <ActionMenuItem action={'SELECT_ALL'} />
      <ActionMenuItem action={'SELECT_ALL_NODES'} />
      <ActionMenuItem action={'SELECT_ALL_EDGES'} />
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
