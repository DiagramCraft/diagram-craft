import { ActionMenuItem } from '../../components/ActionMenuItem';
import { type ReactElement } from 'react';
import { ActionToggleMenuItem } from '../../components/ActionToggleMenuItem';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { Menu } from '@diagram-craft/app-components/Menu';

export const LayerContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger element={props.element} />
      <ContextMenu.Menu>
        <Menu.SubMenu label={'New'}>
          <ActionMenuItem action={'LAYER_ADD'}>Layer...</ActionMenuItem>
          <ActionMenuItem action={'LAYER_ADD_REFERENCE'}>Reference layer...</ActionMenuItem>
          <ActionMenuItem action={'LAYER_ADD_RULE'}>Rule layer...</ActionMenuItem>
          <ActionMenuItem action={'LAYER_ADD_MODIFICATION'}>Modification layer...</ActionMenuItem>
        </Menu.SubMenu>

        <Menu.Separator />

        <ActionMenuItem action={'LAYER_RENAME'} arg={{ id: props.layer?.id }}>
          Rename...
        </ActionMenuItem>
        <ActionToggleMenuItem action={'LAYER_TOGGLE_VISIBILITY'} arg={{ id: props.layer?.id }}>
          Visible
        </ActionToggleMenuItem>
        <ActionToggleMenuItem action={'LAYER_TOGGLE_LOCK'} arg={{ id: props.layer?.id }}>
          Locked
        </ActionToggleMenuItem>
        <ActionMenuItem action={'LAYER_DELETE_LAYER'} arg={{ id: props.layer?.id }}>
          Delete
        </ActionMenuItem>

        <Menu.Separator />

        <ActionMenuItem action={'RULE_LAYER_ADD'} arg={{ id: props.layer?.id }}>
          Add rule
        </ActionMenuItem>
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

type Props = {
  layer?: Layer | undefined;
  element: ReactElement;
};
