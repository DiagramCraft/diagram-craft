import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import { TbChevronRight } from 'react-icons/tb';

export const SelectionContextMenu = () => {
  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_CUT'}>Cut</ActionContextMenuItem>
      <ActionContextMenuItem action={'CLIPBOARD_COPY'}>Copy</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Align
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent
            className="cmp-context-menu dark-theme"
            sideOffset={2}
            alignOffset={-5}
          >
            <ActionContextMenuItem action={'ALIGN_TOP'}>Align Top Edges</ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_BOTTOM'}>
              Align Bottom Edges
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_LEFT'}>Align Left Edges</ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_RIGHT'}>Align Right Edges</ActionContextMenuItem>
            <ContextMenu.Separator className="cmp-context-menu__separator" />
            <ActionContextMenuItem action={'ALIGN_CENTER_HORIZONTAL'}>
              Align Centers Horizontally
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_CENTER_VERTICAL'}>
              Align Centers Vertically
            </ActionContextMenuItem>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Arrange
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent
            className="cmp-context-menu dark-theme"
            sideOffset={2}
            alignOffset={-5}
          >
            <ActionContextMenuItem action={'SELECTION_RESTACK_TOP'}>
              Move to front
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'SELECTION_RESTACK_UP'}>
              Move forward
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'SELECTION_RESTACK_BOTTOM'}>
              Move to back
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'SELECTION_RESTACK_DOWN'}>
              Move backward
            </ActionContextMenuItem>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>
    </>
  );
};
