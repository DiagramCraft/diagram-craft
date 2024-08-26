import { ComponentProps, useEffect, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface Dialogs {
      stringInput: {
        props: {
          value?: string;
          title?: string;
          description?: string;
          label?: string;
          saveButtonLabel?: string;
        };
        callback: string;
      };
    }
  }
}

export const StringInputDialog = (props: {
  open: boolean;
  value?: string;
  title?: string;
  description?: string;
  label?: string;
  saveButtonLabel?: string;
  onSave?: (v: string) => void;
  onCancel?: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => {
      ref.current?.focus();
    }, 100);
  });
  return (
    <Dialog
      title={props.title ?? 'Rename'}
      open={props.open}
      onClose={() => {
        props.onCancel?.();
      }}
      buttons={[
        {
          label: props.saveButtonLabel ?? 'Ok',
          type: 'default',
          onClick: () => {
            props.onSave?.(ref.current!.value);
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      {props.description && <p>{props.description}</p>}

      <label>{props.label ?? 'Name'}:</label>
      <div className={'cmp-text-input'}>
        <input
          ref={ref}
          type={'text'}
          size={40}
          defaultValue={props.value ?? ''}
          onKeyDown={e => {
            // TODO: Why is this needed?
            e.stopPropagation();
          }}
        />
      </div>
    </Dialog>
  );
};

export type StringInputDialogState = Omit<ComponentProps<typeof StringInputDialog>, 'onClose'>;
