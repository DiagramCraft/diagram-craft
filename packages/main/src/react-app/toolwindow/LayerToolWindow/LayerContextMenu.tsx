import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React, { useState } from 'react';
import { ToggleActionContextMenuItem } from '../../components/ToggleActionContextMenuItem';
import { MessageDialog, MessageDialogState } from '../../components/MessageDialog';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { useApplicationTriggers } from '../../context/ActionsContext';

export const LayerContextMenu = (props: Props) => {
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<MessageDialogState>(
    MessageDialog.INITIAL_STATE
  );
  const applicationTriggers = useApplicationTriggers();

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="cmp-context-menu">
            <ActionContextMenuItem
              action={'LAYER_RENAME'}
              context={{ id: props.layer?.id, applicationTriggers }}
            >
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
            <ActionContextMenuItem
              action={'LAYER_DELETE_LAYER'}
              context={{ id: props.layer?.id }}
              onBeforeSelect={async () => {
                return new Promise<boolean>(resolve => {
                  setConfirmDeleteDialog({
                    isOpen: true,
                    title: 'Delete layer',
                    message: 'Are you sure you want to delete this layer?',
                    buttons: [
                      {
                        label: 'Cancel',
                        type: 'cancel',
                        onClick: () => resolve(false)
                      },
                      {
                        label: 'Delete',
                        type: 'danger',
                        onClick: () => resolve(true)
                      }
                    ]
                  });
                });
              }}
            >
              Delete
            </ActionContextMenuItem>
            <ContextMenu.Separator className="cmp-context-menu__separator" />
            <ActionContextMenuItem action={'LAYER_ADD'}>New layer...</ActionContextMenuItem>

            <ActionContextMenuItem action={'LAYER_ADD_REFERENCE'}>
              New reference layer...
            </ActionContextMenuItem>

            <ActionContextMenuItem action={'LAYER_ADD_ADJUSTMENT'}>
              New adjustment layer...
            </ActionContextMenuItem>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <MessageDialog
        {...confirmDeleteDialog}
        onClose={() => setConfirmDeleteDialog(MessageDialog.INITIAL_STATE)}
      />
    </>
  );
};

type Props = {
  layer?: Layer | undefined;
  children: React.ReactNode;
};
