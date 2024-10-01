import { Dialog } from '@diagram-craft/app-components/Dialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useState } from 'react';
import { DialogCommand } from '@diagram-craft/canvas/context';
import { EmptyObject } from '@diagram-craft/utils/types';

export const TableInsertDialog = (props: Props) => {
  const [width, setWidth] = useState(6);
  const [height, setHeight] = useState(4);

  return (
    <Dialog
      open={props.open}
      onClose={props.onCancel!}
      title={'Insert Table'}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: props.onCancel! },
        {
          label: 'Insert',
          type: 'default',
          onClick: () => props.onOk!({ width, height })
        }
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
        <div>
          <label htmlFor={'width'}>Width</label>
          <NumberInput id="width" value={width} onChange={v => setWidth(v ?? 0)} />
        </div>

        <div>
          <label htmlFor={'height'}>Height</label>
          <NumberInput id="height" value={height} onChange={v => setHeight(v ?? 0)} />
        </div>
      </div>
    </Dialog>
  );
};

TableInsertDialog.create = (
  onOk: Props['onOk'],
  onCancel: Props['onCancel'] = () => {}
): DialogCommand<EmptyObject, { width: number; height: number }> => {
  return {
    id: 'tableInsert',
    props: {},
    onOk: onOk,
    onCancel: onCancel
  };
};

type Props = {
  open: boolean;
  onOk: (d: { width: number; height: number }) => void;
  onCancel?: () => void;
};
