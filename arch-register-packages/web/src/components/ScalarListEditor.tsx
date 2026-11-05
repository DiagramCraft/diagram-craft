import type { ReactNode } from 'react';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { ListEditor } from './ListEditor';
import { createScalarItem, scalarValues } from '../lib/scalarFieldValues';

type Props = {
  fieldType: SchemaField['type'];
  value: unknown;
  onChange: (items: unknown[]) => void;
  defaultCurrency?: string;
  disabled?: boolean;
  renderItem: (item: unknown, index: number, update: (value: unknown) => void) => ReactNode;
};

/** Shared editor for multi-valued scalar fields, so all call sites look and behave the same. */
export const ScalarListEditor = ({
  fieldType,
  value,
  onChange,
  defaultCurrency,
  disabled,
  renderItem
}: Props) => (
  <ListEditor
    items={scalarValues(value)}
    onChange={onChange}
    addLabel="Add value"
    removeLabel="Remove value"
    emptyMessage="No values"
    reorder="drag"
    disabled={disabled}
    createItem={() => createScalarItem(fieldType, defaultCurrency)}
    renderItem={(item, ctx) => renderItem(item, ctx.index, ctx.replace)}
  />
);
