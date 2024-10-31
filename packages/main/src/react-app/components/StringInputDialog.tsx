import { useEffect, useRef } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { StringInputDialogProps } from '@diagram-craft/canvas-app/dialogs';

type Props = {
  open: boolean;
  onOk: (v: string) => void;
  onCancel?: () => void;
} & StringInputDialogProps;

export const StringInputDialog = (props: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!props.open) return;
    setTimeout(() => {
      inputRef.current?.focus();
      areaRef.current?.focus();
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
            if (props.type === 'string' || props.type === undefined) {
              props.onOk?.(inputRef.current!.value);
            } else {
              props.onOk?.(areaRef.current!.value);
            }
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      {props.description && <p>{props.description}</p>}

      <label>{props.label ?? 'Name'}:</label>
      {(props.type === 'string' || props.type === undefined) && (
        <div className={'cmp-text-input'}>
          <input
            ref={inputRef}
            type={'text'}
            size={40}
            defaultValue={props.value ?? ''}
            onKeyDown={e => {
              // TODO: Why is this needed?
              e.stopPropagation();
            }}
          />
        </div>
      )}
      {props.type === 'text' && (
        <div className={'cmp-text-input'}>
          <textarea
            ref={areaRef}
            cols={40}
            rows={10}
            defaultValue={props.value ?? ''}
            onKeyDown={e => {
              // TODO: Why is this needed?
              e.stopPropagation();
            }}
          />
        </div>
      )}
    </Dialog>
  );
};
