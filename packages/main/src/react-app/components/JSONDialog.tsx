import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog.tsx';

export function JSONDialog<T>(
  props: Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
    title: string;
    description?: string;
    label: string;
    data: T | undefined;
    onModify: (v: T) => void;
  }
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.isOpen) {
      setTimeout(() => {
        ref.current?.focus();
      }, 100);
    }
  });
  return (
    <Dialog
      title={props.title}
      isOpen={props.isOpen}
      onClose={props.onClose}
      buttons={[
        {
          label: 'Save',
          type: 'default',
          onClick: () => {
            try {
              JSON.parse(ref.current!.value);
            } catch (e) {
              setError(e?.toString());
              throw e;
            }
            props.onModify(JSON.parse(ref.current!.value));
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: () => {} }
      ]}
    >
      {props.description && <p>{props.description}</p>}

      <label>{props.label ?? 'JSON'}:</label>
      <div className={'cmp-text-input'}>
        <textarea
          ref={ref}
          rows={30}
          cols={60}
          defaultValue={JSON.stringify(props.data ? props.data : {}, undefined, 2)}
        />
      </div>
      {error && <div className={'cmp-text-input__error'}>Error: {error}</div>}
    </Dialog>
  );
}
