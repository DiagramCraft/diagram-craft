import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './ActionContextMenuItem.tsx';
import { KeyMap } from '../../base-ui/keyMap.ts';

export const SelectionContextMenu = (props: Props) => {
  return (
    <>
      <ContextMenu.Item className="cmp-context-menu__item">
        Selection <div className="cmp-context-menu__right-slot">⌘+[</div>
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Align
          <div className="cmp-context-menu__right-slot">...</div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent
            className="cmp-context-menu dark-theme"
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
            <ContextMenu.Separator className="cmp-context-menu__separator" />
            <ActionContextMenuItem action={'ALIGN_CENTER_HORIZONTAL'} {...props}>
              Align Centers Horizontally
            </ActionContextMenuItem>
            <ActionContextMenuItem action={'ALIGN_CENTER_VERTICAL'} {...props}>
              Align Centers Vertically
            </ActionContextMenuItem>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      <ContextMenu.Separator className="cmp-context-menu__separator" />
    </>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
};
