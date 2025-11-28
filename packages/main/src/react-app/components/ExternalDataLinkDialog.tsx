import { useDocument } from '../../application';
import { useState, useEffect } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Button } from '@diagram-craft/app-components/Button';
import { ExternalDataLinkActionProps } from '../actions/externalDataActions';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import type { FlatObject } from '@diagram-craft/utils/flatObject';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { newid } from '@diagram-craft/utils/id';
import {
  decodeDataReferences,
  encodeDataReferences
} from '@diagram-craft/model/diagramDocumentDataSchemas';
import { ReferenceFieldEditor } from './ReferenceFieldEditor';

type Props = {
  open: boolean;
  onOk: (data: { uid: string; formData?: FlatObject }) => void;
  onCancel: () => void;
  hasElementData?: boolean;
  elementData?: FlatObject;
  canCreateData?: boolean;
  elementName?: string;
} & ExternalDataLinkActionProps;

export const ExternalDataLinkDialog = (props: Props) => {
  const $d = useDocument();
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'link' | 'create'>('link');
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});

  const showCreateOption = props.canCreateData;

  const data = !props.open
    ? []
    : activeQuery !== undefined && activeQuery.trim() !== ''
      ? $d.data.db.queryData(props.schema, activeQuery)
      : $d.data.db.getData(props.schema);

  // Initialize form data when dialog opens or mode changes to create
  useEffect(() => {
    if (props.open && mode === 'create') {
      const initialData: Record<string, string | string[]> = {};

      props.schema.fields.forEach(field => {
        if (field.type === 'reference') {
          // For reference fields, decode from elementData or use empty array
          const fieldValue = props.elementData?.[field.id];
          initialData[field.id] =
            fieldValue !== undefined && fieldValue !== null
              ? decodeDataReferences(fieldValue as string)
              : [];
        } else {
          // For text/longtext fields
          if (props.elementData?.[field.id]) {
            // Use elementData if available
            initialData[field.id] = props.elementData[field.id] as string;
          } else if (props.elementName && field.name.toLowerCase() === 'name') {
            // Use element name for fields with name='Name' (case-insensitive)
            initialData[field.id] = props.elementName;
          } else {
            // Empty string as fallback
            initialData[field.id] = '';
          }
        }
      });

      setFormData(initialData);
    }
  }, [props.open, mode, props.schema, props.elementData, props.elementName]);

  const handleOk = () => {
    if (mode === 'create') {
      const processedData: FlatObject = {};
      props.schema.fields.forEach(field => {
        const value = formData[field.id];
        if (field.type === 'reference') {
          processedData[field.id] = encodeDataReferences(value as string[]);
        } else {
          processedData[field.id] = value as string;
        }
      });

      props.onOk({ uid: newid(), formData: processedData });
    } else if (selected) {
      props.onOk({ uid: selected });
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
            <div className={'util-vstack'} style={{ gap: '0.5rem', marginTop: '0.25rem' }}>
              {props.schema.fields.map(field => (
                <div key={field.id} className={'util-vstack'} style={{ gap: '0.2rem' }}>
                  <label>{field.name}:</label>
                  {field.type === 'reference' ? (
                    <ReferenceFieldEditor
                      field={field}
                      selectedValues={formData[field.id] as string[]}
                      onSelectionChange={values =>
                        setFormData(prev => ({ ...prev, [field.id]: values }))
                      }
                    />
                  ) : field.type === 'longtext' ? (
                    <TextArea
                      value={(formData[field.id] as string | undefined) ?? ''}
                      onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
                      style={{
                        minHeight: '5rem'
                      }}
                    />
                  ) : (
                    <TextInput
                      value={(formData[field.id] as string | undefined) ?? ''}
                      onChange={v => setFormData(prev => ({ ...prev, [field.id]: v ?? '' }))}
                    />
                  )}
                </div>
              ))}
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
