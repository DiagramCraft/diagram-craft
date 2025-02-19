import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { TextArea } from '@diagram-craft/app-components/TextArea';

type Props<T> = {
  title: string;
  description?: string;
  label: string;
  data: T | undefined;
};

export function JSONDialog<T>(
  props: Omit<ComponentProps<typeof Dialog>, 'children' | 'title' | 'buttons'> & {
    onOk: (v: T) => void;
    onCancel?: () => void;
  } & Props<T>
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.open) {
      setTimeout(() => {
        ref.current?.focus();
      }, 100);
    }
  });
  return (
    <Dialog
      title={props.title}
      open={props.open}
      onClose={() => {}}
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
            props.onOk(JSON.parse(ref.current!.value));
          }
        },
        { label: 'Cancel', type: 'cancel', onClick: props.onCancel ?? (() => {}) }
      ]}
    >
      {props.description && <p>{props.description}</p>}

      <label>{props.label ?? 'JSON'}:</label>
      <TextArea
        ref={ref}
        rows={30}
        cols={60}
        value={JSON.stringify(props.data ? props.data : {}, undefined, 2)}
      />
      {error && <div className={'cmp-error'}>Error: {error}</div>}
    </Dialog>
  );
}

function create<T>(
  props: Props<T>,
  onOk: (v: T) => void,
  onCancel: () => void = () => {}
): DialogCommand<Props<T>, T> {
  return {
    id: 'json',
    props: props,
    onCancel: onCancel,
    onOk: onOk
  };
}

JSONDialog.create = create;
