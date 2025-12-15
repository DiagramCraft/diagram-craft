import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import { type ReactElement } from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { Menu } from '@diagram-craft/app-components/Menu';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger element={props.element} />
      <ContextMenu.Menu>
        <Menu.SubMenu label={'New'}>
          <ActionContextMenuItem action={'LAYER_ADD'}>Layer...</ActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_ADD_REFERENCE'}>
            Reference layer...
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_ADD_RULE'}>Rule layer...</ActionContextMenuItem>
          <ActionContextMenuItem action={'LAYER_ADD_MODIFICATION'}>
            Modification layer...
          </ActionContextMenuItem>
        </Menu.SubMenu>

        <Menu.Separator />

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

        <Menu.Separator />

        <ActionContextMenuItem action={'RULE_LAYER_ADD'} arg={{ id: props.layer?.id }}>
          Add rule
        </ActionContextMenuItem>
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

type Props = {
  layer?: Layer | undefined;
  element: ReactElement;
};
