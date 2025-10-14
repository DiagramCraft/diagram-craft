import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { TbChevronRight } from 'react-icons/tb';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="cmp-context-menu__sub-trigger">
              New
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
                <ActionContextMenuItem action={'LAYER_ADD'}>Layer...</ActionContextMenuItem>
                <ActionContextMenuItem action={'LAYER_ADD_REFERENCE'}>
                  Reference layer...
                </ActionContextMenuItem>
                <ActionContextMenuItem action={'LAYER_ADD_RULE'}>
                  Rule layer...
                </ActionContextMenuItem>
                <ActionContextMenuItem action={'LAYER_ADD_MODIFICATION'}>
                  Modification layer...
                </ActionContextMenuItem>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="cmp-context-menu__separator" />

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
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type Props = {
  layer?: Layer | undefined;
  children: React.ReactNode;
};
