import { Dialog } from '@diagram-craft/app-components/Dialog';
import { useEffect, useRef, useState } from 'react';
import { TbLine, TbPencilCode, TbPentagon } from 'react-icons/tb';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { deepClone } from '@diagram-craft/utils/object';
import { EditorTypes } from './editors';
import { AdjustmentRule, AdjustmentRuleAction } from '@diagram-craft/model/diagramLayerRuleTypes';
import { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';
import { RuleEditorDialogProps } from '@diagram-craft/canvas-app/dialogs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import styles from './RuleEditorDialog.module.css';
import { mustExist } from '@diagram-craft/utils/assert';
import { RuleEditorSubDialogSimple } from './RuleEditorDialog.simple';
import { RuleEditorSubDialogAdvanced } from './RuleEditorDialog.advanced';

export type EditableAdjustmentRuleAction = Partial<AdjustmentRuleAction> & { kind?: string };
export type EditableElementSearchClause = Partial<ElementSearchClause>;

export type SubRuleEditorDialogRef = {
  apply: (dest: AdjustmentRule) => void;
};

export const RuleEditorDialog = (props: Props) => {
  const [type, setType] = useState<EditorTypes>(props.rule?.type ?? 'node');
  const [rule] = useState(deepClone(props.rule));

  const simpleRef = useRef<SubRuleEditorDialogRef>(null);
  const advancedRef = useRef<SubRuleEditorDialogRef>(null);

  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => ref.current?.focus(), 100);
  }, [props.open]);

  if (!props.rule || !rule) return null;

  return (
    <Dialog
      open={props.open}
      onClose={() => {}}
      buttons={[
        {
          type: 'cancel',
          onClick: () => {
            props.onCancel?.();
          },
          label: 'Cancel'
        },
        {
          type: 'default',
          onClick: () => {
            rule.name = ref.current!.value;
            rule.type = type;

            if (rule.type === 'node' || rule.type === 'edge') {
              mustExist(simpleRef.current).apply(rule);
            } else {
              mustExist(advancedRef.current).apply(rule);
            }

            props.onOk(rule);
          },
          label: 'Save'
        }
      ]}
      title={'Rule Editor'}
    >
      <div className={styles.ruleEditor__container}>
        <div>
          <label>{'Name'}:</label>
          <TextInput ref={ref} value={rule.name} size={40} />
        </div>
        <div>
          <label>{'Type'}:</label>
          <div>
            <ToggleButtonGroup.Root
              type={'single'}
              value={type}
              onChange={value => {
                // biome-ignore lint/suspicious/noExplicitAny: false positive
                setType(value as any);
              }}
            >
              <ToggleButtonGroup.Item value={'node'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbPentagon /> Node
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'edge'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbLine /> Edge
                </div>
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'advanced'}>
                <div className={styles.ruleEditor__typeButtonContainer}>
                  <TbPencilCode /> Advanced
                </div>
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        </div>
      </div>
      {type === 'node' && (
        <RuleEditorSubDialogSimple
          ref={simpleRef}
          rule={rule as AdjustmentRule & { type: 'node' }}
          type={type}
        />
      )}
      {type === 'edge' && (
        <RuleEditorSubDialogSimple
          ref={simpleRef}
          rule={rule as AdjustmentRule & { type: 'edge' }}
          type={type}
        />
      )}
      {type === 'advanced' && (
        <RuleEditorSubDialogAdvanced
          ref={advancedRef}
          rule={rule as AdjustmentRule & { type: 'advanced' }}
          type={type}
        />
      )}
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onOk: (rule: AdjustmentRule) => void;
  onCancel?: () => void;
} & RuleEditorDialogProps;
