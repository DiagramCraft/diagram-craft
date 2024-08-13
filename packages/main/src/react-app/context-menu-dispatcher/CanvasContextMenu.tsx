import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ContextMenuTarget } from '@diagram-craft/canvas/ApplicationTriggers';

export const CanvasContextMenu = (props: Props) => {
  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_PASTE'} context={{ point: props.target.pos }}>
        Paste
      </ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'UNDO'}>Undo</ActionContextMenuItem>
      <ActionContextMenuItem action={'REDO'}>Redo</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />
      <ActionContextMenuItem action={'SELECT_ALL'}>Select All</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_NODES'}>Select Nodes</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECT_ALL_EDGES'}>Select Edges</ActionContextMenuItem>
    </>
  );
};

type Props = {
  target: ContextMenuTarget<'canvas'>;
};
