import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRuleTypes';

export type StringInputDialogProps = {
  value?: string;
  title?: string;
  description?: string;
  label?: string;
  saveButtonLabel?: string;
  type?: 'string' | 'text';
};

export class StringInputDialogCommand implements DialogCommand<StringInputDialogProps, string> {
  id = 'stringInput';

  constructor(
    public readonly props: StringInputDialogProps,
    public readonly onOk: (data: string) => void,
    public readonly onCancel: () => void = () => {}
  ) {}
}

export type ReferenceLayerDialogSaveArg = { diagramId: string; layerId: string; name: string };

export class ReferenceLayerDialogCommand
  implements DialogCommand<EmptyObject, ReferenceLayerDialogSaveArg>
{
  id = 'newReferenceLayer';
  props = {};

  constructor(
    public readonly onOk: (data: ReferenceLayerDialogSaveArg) => void,
    public readonly onCancel: () => void = () => {}
  ) {}
}

export type RuleEditorDialogProps = {
  rule?: AdjustmentRule;
};

export class RuleEditorDialogCommand
  implements DialogCommand<RuleEditorDialogProps, AdjustmentRule>
{
  id = 'ruleEditor';

  constructor(
    public readonly props: RuleEditorDialogProps,
    public readonly onOk: (data: AdjustmentRule) => void,
    public readonly onCancel: () => void = () => {}
  ) {}
}
