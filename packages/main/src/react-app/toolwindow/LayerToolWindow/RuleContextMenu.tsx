import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React, { useState } from 'react';
import { MessageDialog, MessageDialogState } from '../../components/MessageDialog';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';

export const RuleContextMenu = (props: Props) => {
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<MessageDialogState>(
    MessageDialog.INITIAL_STATE
  );

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="cmp-context-menu">
            <ActionContextMenuItem
              action={'RULE_LAYER_EDIT'}
              context={{ id: `${props.layer.id}:${props.rule.id}` }}
            >
              Edit
            </ActionContextMenuItem>
            <ActionContextMenuItem
              action={'RULE_LAYER_DELETE'}
              context={{ id: `${props.layer.id}:${props.rule.id}` }}
            >
              Delete
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
  layer: Layer;
  rule: AdjustmentRule;
  children: React.ReactNode;
};
