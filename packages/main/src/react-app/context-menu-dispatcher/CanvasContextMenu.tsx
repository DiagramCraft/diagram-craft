import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_PASTE'} arg={{ point: props.target.pos }}>
        Paste
      </ActionContextMenuItem>
      <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'UNDO'}>Undo</ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'}>Redo</ActionContextMenuItem>
      <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'COMMENT_ADD'}>Add Comment</ActionContextMenuItem>
      <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'SELECT_ALL'}>Select All</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_NODES'}>Select Nodes</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_EDGES'}>Select Edges</ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
