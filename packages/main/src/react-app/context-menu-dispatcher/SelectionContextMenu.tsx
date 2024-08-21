import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
import { TbChevronRight } from 'react-icons/tb';
import { useRedraw } from '../hooks/useRedraw';
import { useDiagram } from '../context/DiagramContext';
import { useEventListener } from '../hooks/useEventListener';

export const SelectionContextMenu = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();

  useEventListener(diagram, 'change', redraw);

  return (
    <>
      <ActionContextMenuItem action={'CLIPBOARD_CUT'}>Cut</ActionContextMenuItem>
      <ActionContextMenuItem action={'CLIPBOARD_COPY'}>Copy</ActionContextMenuItem>
      <ActionContextMenuItem action={'DUPLICATE'}>Duplicate</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />

      <ActionContextMenuItem action={'STYLE_COPY'}>Copy Style</ActionContextMenuItem>
      <ActionContextMenuItem action={'STYLE_PASTE'}>Paste Style</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />

      <ActionContextMenuItem action={'GROUP_GROUP'}>Group</ActionContextMenuItem>
      <ActionContextMenuItem action={'GROUP_UNGROUP'}>Ungroup</ActionContextMenuItem>
      <ContextMenu.Separator className="cmp-context-menu__separator" />

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Debug
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
            <ActionContextMenuItem action={'SELECTION_DUMP'}>Dump</ActionContextMenuItem>
            <ActionContextMenuItem action={'SELECTION_REDRAW'}>Redraw</ActionContextMenuItem>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>
      <ContextMenu.Separator className="cmp-context-menu__separator" />

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Align
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
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
          <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
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

      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
          Move to
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
            <ActionContextMenuItem action={'LAYER_SELECTION_MOVE_NEW'}>
              Create new layer
            </ActionContextMenuItem>
            <ContextMenu.Separator className="cmp-context-menu__separator" />
            {layers.map(layer => (
              <ActionContextMenuItem
                key={layer.id}
                action={'LAYER_SELECTION_MOVE'}
                context={{ id: layer.id }}
              >
                {layer.name}
              </ActionContextMenuItem>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>
    </>
  );
};
