import { useDiagram } from '../../../application';
import { findEntryBySchema } from '@diagram-craft/canvas-app/externalDataHelpers';
import { DataSchema, DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { unique } from '@diagram-craft/utils/array';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import React, { useCallback } from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const DataField = (props: {
  field: DataSchemaField;
  value: unknown[];
  disabled?: boolean;
  onChange: (v: boolean | string | undefined) => void;
}) => (
  <React.Fragment>
    <dt>{props.field.name}:</dt>
    <dd data-type={props.field.type} data-label={props.field.name}>
      <div style={{ display: 'inline-block' }}>
        {props.field.type === 'text' && (
          <TextInput
            value={props.value.length > 1 ? '***' : (props.value[0]?.toString() ?? '')}
            disabled={props.disabled}
            onChange={props.onChange}
          />
        )}
        {props.field.type === 'boolean' && (
          <Checkbox
            value={props.value.length > 1 ? false : props.value[0]?.toString() === 'true'}
            disabled={props.disabled}
            onChange={v => props.onChange(v ? true : false)}
          />
        )}
        {props.field.type === 'longtext' && (
          <TextArea
            style={{ height: '40px' }}
            value={props.value.length > 1 ? '***' : (props.value[0]?.toString() ?? '')}
            disabled={props.disabled}
            onChange={props.onChange}
          />
        )}
        {props.field.type === 'select' && (
          <Select.Root
            value={
              (props.value[0]?.toString() === ''
                ? props.field.options[0]?.value
                : props.value[0]?.toString()) ?? ''
            }
            isIndeterminate={props.value.length > 1}
            disabled={props.disabled}
            onChange={props.onChange}
          >
            {props.field.options.map(o => (
              <Select.Item key={o.value} value={o.value}>
                {o.label}
              </Select.Item>
            ))}
          </Select.Root>
        )}
      </div>
    </dd>
  </React.Fragment>
);

export const DataFields = (props: { schema: DataSchema; disabled?: boolean }) => {
  const $d = useDiagram();

  const changDataCallback = useCallback(
    (id: string, v: boolean | string | undefined) => {
      UnitOfWork.executeWithUndo($d, 'Update data', uow => {
        $d.selection.elements.forEach(e => {
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.data ??= [];
            let s = p.data.data.find(e => e.schema === props.schema.id);
            if (!s) {
              s = { schema: props.schema.id, type: 'schema', data: {}, enabled: true };
              p.data.data.push(s);
            } else if (!s.enabled) {
              s.enabled = true;
            }
            s.data ??= {};
            s.data[id] = v;
          }, uow);
        });
      });
    },
    [$d, props.schema.id]
  );

  return (
    <dl>
      {props.schema.fields.map(field => {
        const values = unique(
          $d.selection.elements.map(e => {
            const d = findEntryBySchema(e, props.schema.id);
            try {
              return d?.data?.[field.id] ?? '';
            } catch (_e) {
              return '';
            }
          })
        );

        return (
          <DataField
            key={field.id}
            field={field}
            value={values}
            disabled={props.disabled}
            onChange={v => changDataCallback(field.id, v)}
          />
        );
      })}
    </dl>
  );
};
