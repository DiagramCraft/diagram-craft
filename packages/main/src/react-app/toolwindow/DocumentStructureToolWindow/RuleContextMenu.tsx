import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import { type ReactElement } from 'react';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ContextMenu as BaseUIContextMenu } from '@base-ui-components/react/context-menu';

export const RuleContextMenu = (props: Props) => {
  return (
    <BaseUIContextMenu.Root>
      <BaseUIContextMenu.Trigger render={props.element} />
      <BaseUIContextMenu.Portal>
        <BaseUIContextMenu.Positioner>
          <BaseUIContextMenu.Popup className="cmp-context-menu">
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
          </BaseUIContextMenu.Popup>
        </BaseUIContextMenu.Positioner>
      </BaseUIContextMenu.Portal>
    </BaseUIContextMenu.Root>
  );
};

type Props = {
  layer: Layer;
  rule: AdjustmentRule;
  element: ReactElement;
};
