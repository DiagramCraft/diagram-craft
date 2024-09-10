import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { EditorTypes } from './editors';
import { EditableAdjustmentRuleAction } from './RuleEditorDialog';

export const HideAction = (props: Props) => {
  if (props.action.type !== 'hide') throw new VerifyNotReached();

  return <div></div>;
};

type Props = {
  action: EditableAdjustmentRuleAction;
  onChange: (a: EditableAdjustmentRuleAction) => void;
  type: EditorTypes;
};
