import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import React from 'react';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';

export const RuleContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true}>{props.children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="cmp-context-menu">
          <ActionContextMenuItem
            action={'RULE_LAYER_EDIT'}
            arg={{ id: `${props.layer.id}:${props.rule.id}` }}
          >
            Edit
          </ActionContextMenuItem>
          <ActionContextMenuItem
            action={'RULE_LAYER_DELETE'}
            arg={{ id: `${props.layer.id}:${props.rule.id}` }}
          >
            Delete
          </ActionContextMenuItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type Props = {
  layer: Layer;
  rule: AdjustmentRule;
  children: React.ReactNode;
};
