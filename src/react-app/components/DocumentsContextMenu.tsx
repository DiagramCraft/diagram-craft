import { ActionContextMenuItem } from '../context-menu/ActionContextMenuItem.tsx';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ReactNode } from 'react';

export const DocumentsContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu dark-theme">
          <ActionContextMenuItem action={'EDGE_FLIP'}>Rename...</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Add</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Add subpage</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Delete</ActionContextMenuItem>
          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'EDGE_FLIP'}>Sheet 1.1</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Sheet 1.2</ActionContextMenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type Props = {
  documentId: string;
  children: ReactNode;
};
