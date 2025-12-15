import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import { type ReactElement } from 'react';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';

export const RuleContextMenu = (props: Props) => {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger element={props.element} />
      <ContextMenu.Menu>
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
      </ContextMenu.Menu>
    </ContextMenu.Root>
  );
};

type Props = {
  layer: Layer;
  rule: AdjustmentRule;
  element: ReactElement;
};
