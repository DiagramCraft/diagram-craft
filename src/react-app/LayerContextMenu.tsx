import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './context-menu/ActionContextMenuItem.tsx';
import { Layer } from '../model/diagramLayer.ts';
import React from 'react';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ActionContextMenuItem action={'EDGE_FLIP'} context={{ id: props.layer?.id }}>
            Rename...
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'} context={{ id: props.layer?.id }}>
            Hide/show
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'} context={{ id: props.layer?.id }}>
            Lock/unlock
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'} context={{ id: props.layer?.id }}>
            Delete
          </ActionContextMenuItem>
          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'EDGE_FLIP'}>New layer...</ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>
            New adjustment layer...
          </ActionContextMenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type Props = {
  layer?: Layer | undefined;
  children: React.ReactNode;
};
