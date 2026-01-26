import { useDiagram } from '../../../application';
import { findEntryBySchema } from '@diagram-craft/canvas-app/externalDataHelpers';
import { DataSchema, DataSchemaField } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { unique } from '@diagram-craft/utils/array';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import React from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';

const DataField = (props: {
  field: DataSchemaField;
  value: unknown[];
  disabled?: boolean;
  onChange: (v: boolean | string | undefined) => void;
}) => (
  <React.Fragment>
    <div className={'cmp-labeled-table__label util-a-top-center'}>{props.field.name}:</div>
    <div className={'cmp-labeled-table__value'}>
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
  </React.Fragment>
);

export const DataFields = (props: {
  schema: DataSchema;
  onChange: (field: DataSchemaField, value: boolean | string | undefined) => void;
  disabled?: boolean;
}) => {
  const $d = useDiagram();
  return (
    <div className={'cmp-labeled-table'}>
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
            onChange={v => props.onChange(field, v)}
          />
        );
      })}
    </div>
  );
};
