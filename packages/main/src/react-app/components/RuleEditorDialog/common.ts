import type { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';
import type { EdgeEditorRegistry, NodeEditorRegistry } from './editors';
import type { EditableAdjustmentRuleAction } from './RuleEditorDialog';
import { NotImplementedYet } from '@diagram-craft/utils/assert';
import { PropsEditor } from './PropsEditor';
import { newid } from '@diagram-craft/utils/id';

export const normalizeRuleActions = (
  rule: AdjustmentRule | undefined,
  registry: NodeEditorRegistry | EdgeEditorRegistry
): Array<EditableAdjustmentRuleAction> => {
  if (!rule) return [];
  if (rule.type === 'advanced') throw new NotImplementedYet();

  const dest: Array<EditableAdjustmentRuleAction> = [];
  for (const a of rule.actions) {
    if (a.type === 'set-props') {
      const propsEditor = new PropsEditor(registry, a.props);
      for (const e of propsEditor.getEntries()) {
        dest.push({
          id: newid(),
          type: 'set-props',
          props: e.props,
          kind: e.kind
        });
      }
    } else {
      dest.push(a);
    }
  }

  return dest;
};
