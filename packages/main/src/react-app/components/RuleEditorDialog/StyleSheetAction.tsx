import { Select } from '@diagram-craft/app-components/Select';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { EditorTypes } from './editors';
import { EditableAdjustmentRuleAction } from './RuleEditorDialog';
import { useDiagram } from '../../context/DiagramContext';

export const StyleSheetAction = (props: Props) => {
  const $d = useDiagram();

  if (props.action.type !== 'set-stylesheet') throw new VerifyNotReached();

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {props.type === 'node' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Select.Root
            value={props.action.elementStyle ?? ''}
            placeholder={'Node Style'}
            onChange={k => {
              if (props.action.type !== 'set-stylesheet') throw new VerifyNotReached();
              props.action.elementStyle = k;
              props.onChange(props.action);
            }}
          >
            {$d.document.styles.nodeStyles.map(e => {
              return (
                <Select.Item key={e.id} value={e.id}>
                  {e.name}
                </Select.Item>
              );
            })}
          </Select.Root>

          <Select.Root
            value={props.action.textStyle ?? ''}
            placeholder={'Text Style'}
            onChange={k => {
              if (props.action.type !== 'set-stylesheet') throw new VerifyNotReached();
              props.action.textStyle = k;
              props.onChange(props.action);
            }}
          >
            {$d.document.styles.textStyles.map(e => {
              return (
                <Select.Item key={e.id} value={e.id}>
                  {e.name}
                </Select.Item>
              );
            })}
          </Select.Root>
        </div>
      )}

      {props.type === 'edge' && (
        <Select.Root
          value={props.action.elementStyle ?? ''}
          placeholder={'Edge Style'}
          onChange={k => {
            if (props.action.type !== 'set-stylesheet') throw new VerifyNotReached();
            props.action.elementStyle = k;
            props.onChange(props.action);
          }}
        >
          {$d.document.styles.edgeStyles.map(e => {
            return (
              <Select.Item key={e.id} value={e.id}>
                {e.name}
              </Select.Item>
            );
          })}
        </Select.Root>
      )}
    </div>
  );
};

type Props = {
  action: EditableAdjustmentRuleAction;
  onChange: (a: EditableAdjustmentRuleAction) => void;
  type: EditorTypes;
};
