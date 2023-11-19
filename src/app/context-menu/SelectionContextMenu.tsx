import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import { KeyMap } from '../../canvas/keyMap.ts';

export const SelectionContextMenu = (props: Props) => {
  return (
    <>
      <ContextMenu.Item className="ContextMenuItem">
        Selection <div className="RightSlot">⌘+[</div>
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
          Align
          <div className="RightSlot">...</div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent
            className="ContextMenuSubContent dark-theme"
            sideOffset={2}
            alignOffset={-5}
          >
            <ActionContextMenuItem action={'ALIGN_TOP'} {...props}>
              Align Top Edges
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_BOTTOM'} {...props}>
              Align Bottom Edges
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_LEFT'} {...props}>
              Align Left Edges
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_RIGHT'} {...props}>
              Align Right Edges
            </ActionContextMenuItem>
            <ContextMenu.Separator className="ContextMenuSeparator" />
            <ActionContextMenuItem action={'ALIGN_CENTER_HORIZONTAL'} {...props}>
              Align Centers Horizontally
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_CENTER_VERTICAL'} {...props}>
              Align Centers Vertically
            </ActionContextMenuItem>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      <ContextMenu.Separator className="ContextMenuSeparator" />
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
