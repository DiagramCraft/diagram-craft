import { Select } from '@diagram-craft/app-components/Select';
import { PropsEditor } from '@diagram-craft/canvas-app/PropsEditor';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { EDITORS } from './editors';
import { EditableAdjustmentRuleAction } from './RuleEditorDialog';

export const StyleAction = (props: Props) => {
  if (props.action.type !== 'set-props') throw new VerifyNotReached();

  props.action.props ??= {};

  const propsEditor = new PropsEditor(EDITORS);

  // @ts-ignore
  const entry = EDITORS[props.action.kind];

  return (
    <div
      style={{ display: 'grid', gap: '0.5rem', position: 'relative', gridTemplateColumns: '1fr' }}
    >
      <Select.Root
        value={props.action?.kind ?? ''}
        placeholder={'Style'}
        onValueChange={k => {
          props.action.kind = k;
          props.onChange(props.action);
        }}
      >
        {propsEditor.getAllEntries().map(e => {
          return (
            <Select.Item key={e.kind} value={e.kind}>
              {e.name}
            </Select.Item>
          );
        })}
      </Select.Root>

      {entry && (
        <div
          style={{
            border: '1px solid var(--cmp-border)',
            borderRadius: 'var(--cmp-radius)',
            padding: '0.75rem'
          }}
        >
          <div style={{ maxWidth: '250px' }}>
            {entry && (
              <entry.editor
                props={props.action.props ?? {}}
                onChange={() => props.onChange(props.action)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

type Props = {
  action: EditableAdjustmentRuleAction;
  onChange: (a: EditableAdjustmentRuleAction) => void;
};
