import { useDocument } from '../../application';
import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { ExternalDataLinkActionProps } from '../actions/externalDataActions';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { FlatObject } from '@diagram-craft/utils/types';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { newid } from '@diagram-craft/utils/id';

type Props = {
  open: boolean;
  onOk: (v: string) => void;
  onCancel: () => void;
  hasElementData?: boolean;
  elementData?: FlatObject;
  canCreateData?: boolean;
} & ExternalDataLinkActionProps;

export const ExternalDataLinkDialog = (props: Props) => {
  const $d = useDocument();
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'link' | 'create'>('link');

  const showCreateOption = props.hasElementData && props.canCreateData;

  const data = !props.open
    ? []
    : activeQuery !== undefined && activeQuery.trim() !== ''
      ? $d.data.db.queryData(props.schema, activeQuery)
      : $d.data.db.getData(props.schema);

  const handleOk = () => {
    if (mode === 'create') {
      // Generate a new uid for create mode - the action will detect this doesn't exist
      props.onOk(newid());
    } else if (selected) {
      props.onOk(selected);
    } else {
      props.onCancel();
    }
  };

  return (
    <Dialog
      buttons={[
        {
          type: 'default',
          onClick: handleOk,
          label: mode === 'create' ? 'Create & Link' : 'Link'
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
      {showCreateOption ? (
        <Tabs.Root value={mode} onValueChange={v => setMode(v as 'link' | 'create')}>
          <Tabs.List>
            <Tabs.Trigger value="link">Link to existing</Tabs.Trigger>
            <Tabs.Trigger value="create">Create new</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="link">
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
                      {item['name'] ?? item[props.schema.fields[0]!.id]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="create">
            <div
              className={'util-vstack'}
              style={{
                background: 'var(--cmp-bg)',
                border: '1px solid var(--cmp-border)',
                borderRadius: 'var(--cmp-radius)',
                padding: '0.75rem',
                gap: '0.5rem',
                marginTop: '1rem'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                Data to be created:
              </div>
              {props.elementData &&
                Object.entries(props.elementData)
                  .filter(([key]) => !key.startsWith('_'))
                  .map(([key, value]) => {
                    const field = props.schema.fields.find(f => f.id === key);
                    return (
                      <div key={key} style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '500', minWidth: '100px' }}>
                          {field?.name ?? key}:
                        </span>
                        <span>{value?.toString() ?? ''}</span>
                      </div>
                    );
                  })}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      ) : (
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
                  {item['name'] ?? item[props.schema.fields[0]!.id]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
};
