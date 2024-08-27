import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import { AdjustmentRule } from '@diagram-craft/model/diagramLayerRule';
import { useEffect, useRef } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbTrash } from 'react-icons/tb';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      ruleEditor: {
        props: {
          rule: AdjustmentRule;
        };
        callback: AdjustmentRule;
      };
    }
  }
}

export const RuleEditorDialog = (props: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });

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
          type: 'secondary',
          onClick: () => {},
          label: 'Preview'
        },
        {
          type: 'default',
          onClick: () => {},
          label: 'Save'
        }
      ]}
      title={'Rule Editor'}
    >
      <label>{'Name'}:</label>
      <div className={'cmp-text-input'}>
        <input
          ref={ref}
          type={'text'}
          size={40}
          defaultValue={props.rule?.name ?? ''}
          onKeyDown={e => {
            // TODO: Why is this needed?
            e.stopPropagation();
          }}
        />
      </div>

      <div>
        <div
          style={{
            display: 'grid',
            margin: '0.5rem 0 2rem 0',
            gap: '0.5rem',
            gridTemplateColumns: '2fr 8fr min-content min-content'
          }}
        >
          <h4 style={{ margin: '0.5rem 0 0 0' }}>If</h4>
          <div></div>
          <div></div>
          <div></div>

          <Select.Root value={'query'} onValueChange={() => {}}>
            <Select.Item value={'query'}>Query</Select.Item>
          </Select.Root>

          <div className={'cmp-text-input'}>
            <input
              type={'text'}
              defaultValue={props.rule?.query ?? ''}
              onKeyDown={e => {
                // TODO: Why is this needed?
                e.stopPropagation();
              }}
            />
          </div>

          <Button type={'icon-only'}>
            <TbPlus />
          </Button>
          <Button type={'icon-only'} disabled={true}>
            <TbTrash />
          </Button>

          <h4 style={{ margin: '0.5rem 0 0 0' }}>Then</h4>
          <div></div>
          <div></div>
          <div></div>

          <Select.Root value={'style'} onValueChange={() => {}}>
            <Select.Item value={'style'}>Set style</Select.Item>
          </Select.Root>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Select.Root value={'fill.color'} onValueChange={() => {}}>
              <Select.Item value={'fill.color'}>Fill &gt; Color</Select.Item>
            </Select.Root>

            <div className={'cmp-text-input'}>
              <input
                type={'text'}
                defaultValue={'pink'}
                onKeyDown={e => {
                  // TODO: Why is this needed?
                  e.stopPropagation();
                }}
              />
            </div>
          </div>

          <Button type={'icon-only'}>
            <TbPlus />
          </Button>
          <Button type={'icon-only'} disabled={true}>
            <TbTrash />
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

type Props = {
  open: boolean;
  onSave: (rule: AdjustmentRule) => void;
  onCancel: (() => void) | undefined;
  rule?: AdjustmentRule;
};
