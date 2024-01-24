import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from './context-menu/ActionContextMenuItem.tsx';
import { Layer } from '../model/diagramLayer.ts';
import React from 'react';
import { ToggleActionContextMenuItem } from './context-menu/ToggleActionContextMenuItem.tsx';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ActionContextMenuItem action={'LAYER_RENAME'} context={{ id: props.layer?.id }}>
            Rename...
          </ActionContextMenuItem>
          <ToggleActionContextMenuItem
            action={'LAYER_TOGGLE_VISIBILITY'}
            context={{ id: props.layer?.id }}
          >
            Visible
          </ToggleActionContextMenuItem>
          <ToggleActionContextMenuItem
            action={'LAYER_TOGGLE_LOCK'}
            context={{ id: props.layer?.id }}
          >
            Locked
          </ToggleActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_DELETE_LAYER'} context={{ id: props.layer?.id }}>
            Delete
          </ActionContextMenuItem>
          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'LAYER_ADD'}>New layer...</ActionContextMenuItem>

          {/* TODO: Implement this */}
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
