import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import { type ReactElement } from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { TbChevronRight } from 'react-icons/tb';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';

export const LayerContextMenu = (props: Props) => {
  return (
    <BaseUIContextMenu.Root>
      <BaseUIContextMenu.Trigger render={props.element} />
      <BaseUIContextMenu.Portal>
        <BaseUIContextMenu.Positioner>
          <BaseUIContextMenu.Popup className="cmp-context-menu">
            <BaseUIContextMenu.SubmenuRoot>
              <BaseUIContextMenu.SubmenuTrigger className="cmp-context-menu__sub-trigger">
                New
                <div className="cmp-context-menu__right-slot">
                  <TbChevronRight />
                </div>
              </BaseUIContextMenu.SubmenuTrigger>
              <BaseUIContextMenu.Portal>
                <BaseUIContextMenu.Positioner sideOffset={2} alignOffset={-5}>
                  <BaseUIContextMenu.Popup className="cmp-context-menu">
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
                  </BaseUIContextMenu.Popup>
                </BaseUIContextMenu.Positioner>
              </BaseUIContextMenu.Portal>
            </BaseUIContextMenu.SubmenuRoot>

            <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />

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

            <BaseUIContextMenu.Separator className="cmp-context-menu__separator" />

            <ActionContextMenuItem action={'RULE_LAYER_ADD'} arg={{ id: props.layer?.id }}>
              Add rule
            </ActionContextMenuItem>
          </BaseUIContextMenu.Popup>
        </BaseUIContextMenu.Positioner>
      </BaseUIContextMenu.Portal>
    </BaseUIContextMenu.Root>
  );
};

type Props = {
  layer?: Layer | undefined;
  element: ReactElement;
};
