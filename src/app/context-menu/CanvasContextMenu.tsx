import * as ContextMenu from '@radix-ui/react-context-menu';

export const CanvasContextMenu = () => {
  return (
    <>
      <ContextMenu.Item className="ContextMenuItem">
        Canvas <div className="RightSlot">⌘+[</div>
      </ContextMenu.Item>
      <ContextMenu.Item className="ContextMenuItem" disabled>
        Foward <div className="RightSlot">⌘+]</div>
      </ContextMenu.Item>
      <ContextMenu.Item className="ContextMenuItem">
        Reload <div className="RightSlot">⌘+R</div>
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger className="ContextMenuSubTrigger">
          More Tools
          <div className="RightSlot">...</div>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent
            className="ContextMenuSubContent dark-theme"
            sideOffset={2}
            alignOffset={-5}
          >
            <ContextMenu.Item className="ContextMenuItem">
              Save Page As… <div className="RightSlot">⌘+S</div>
            </ContextMenu.Item>
            <ContextMenu.Item className="ContextMenuItem">Create Shortcut…</ContextMenu.Item>
            <ContextMenu.Item className="ContextMenuItem">Name Window…</ContextMenu.Item>
            <ContextMenu.Separator className="ContextMenuSeparator" />
            <ContextMenu.Item className="ContextMenuItem">Developer Tools</ContextMenu.Item>
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>

      <ContextMenu.Separator className="ContextMenuSeparator" />

      <ContextMenu.CheckboxItem
        className="ContextMenuCheckboxItem"
        checked={true}
        onCheckedChange={() => {
          console.log('change');
        }}
      >
        <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
          CHECK
        </ContextMenu.ItemIndicator>
        Show Bookmarks <div className="RightSlot">⌘+B</div>
      </ContextMenu.CheckboxItem>
      <ContextMenu.CheckboxItem
        className="ContextMenuCheckboxItem"
        checked={true}
        onCheckedChange={() => {
          console.log('change');
        }}
      >
        <ContextMenu.ItemIndicator className="ContextMenuItemIndicator">
          Check
        </ContextMenu.ItemIndicator>
        Show Full URLs
      </ContextMenu.CheckboxItem>

      <ContextMenu.Separator className="ContextMenuSeparator" />
    </>
  );
};
