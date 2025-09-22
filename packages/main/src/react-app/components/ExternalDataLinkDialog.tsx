import { useDocument } from '../../application';
import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { ExternalDataLinkActionProps } from '../actions/externalDataActions';
import { TextInput } from '@diagram-craft/app-components/TextInput';

type Props = {
  open: boolean;
  onOk: (v: string) => void;
  onCancel: () => void;
} & ExternalDataLinkActionProps;

export const ExternalDataLinkDialog = (props: Props) => {
  const $d = useDocument();
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const data = !props.open
    ? []
    : activeQuery !== undefined && activeQuery.trim() !== ''
      ? $d.data.manager?.queryData(props.schema, activeQuery)
      : $d.data.manager?.getData(props.schema);

  return (
    <Dialog
      buttons={[
        {
          type: 'default',
          onClick: () => (selected ? props.onOk(selected) : props.onCancel()),
          label: 'Ok'
        },
        {
          type: 'cancel',
          onClick: props.onCancel,
          label: 'Cancel'
        }
      ]}
      onClose={() => props.onCancel()}
      open={props.open}
      title={'Link data'}
    >
      <div className={'util-vstack'} style={{ gap: '1rem' }}>
        <div className={'util-hstack'}>
          <TextInput
            onChange={v => setSearch(v ?? '')}
            value={search}
            onKeyDown={ev => {
              if (ev.key === 'Enter') {
                setActiveQuery(search);
              }
            }}
          />

          <Button onClick={() => setActiveQuery(search)}>Search</Button>
        </div>

        <div
          className={'util-vstack'}
          style={{
            background: 'var(--cmp-bg)',
            border: '1px solid var(--cmp-border)',
            borderRadius: 'var(--cmp-radius)',
            padding: '0.5rem 0.25rem',
            overflow: 'auto',
            maxHeight: '100%',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--base-fg-more-dim) var(--panel-bg)'
          }}
        >
          {data?.map(item => (
            <div
              key={item._uid}
              style={{
                display: 'flex',
                gap: '0.25rem',
                alignItems: 'center'
              }}
            >
              <input
                type={'radio'}
                name={'dataItemId'}
                onClick={() => {
                  setSelected(item._uid);
                }}
              />
              <span style={{ paddingTop: '3px' }}>
                {item['name'] ?? item[props.schema.fields[0].id]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
