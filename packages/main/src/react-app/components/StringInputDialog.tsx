import { useEffect, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { StringInputDialogProps } from '@diagram-craft/canvas-app/dialogs';

type Props = {
  open: boolean;
  onOk: (v: string) => void;
  onCancel?: () => void;
} & StringInputDialogProps;

export const StringInputDialog = (props: Props) => {
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
            props.onOk?.(ref.current!.value);
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
