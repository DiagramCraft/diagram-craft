import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { Layer } from '@diagram-craft/model/diagramLayer';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ActionContextMenuItem action={'LAYER_RENAME'} arg={{ id: props.layer?.id }}>
            Rename...
          </ActionContextMenuItem>
          <ToggleActionContextMenuItem
            action={'LAYER_TOGGLE_VISIBILITY'}
            arg={{ id: props.layer?.id }}
          >
            Visible
          </ToggleActionContextMenuItem>
          <ToggleActionContextMenuItem action={'LAYER_TOGGLE_LOCK'} arg={{ id: props.layer?.id }}>
            Locked
          </ToggleActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_DELETE_LAYER'} arg={{ id: props.layer?.id }}>
            Delete
          </ActionContextMenuItem>
          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'RULE_LAYER_ADD'} arg={{ id: props.layer?.id }}>
            Add rule
          </ActionContextMenuItem>

          <ContextMenu.Separator className="cmp-context-menu__separator" />
          <ActionContextMenuItem action={'LAYER_ADD'}>New layer...</ActionContextMenuItem>

          <ActionContextMenuItem action={'LAYER_ADD_REFERENCE'}>
            New reference layer...
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_ADD_RULE'}>New rule layer...</ActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_ADD_MODIFICATION'}>
            New modification layer...
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
