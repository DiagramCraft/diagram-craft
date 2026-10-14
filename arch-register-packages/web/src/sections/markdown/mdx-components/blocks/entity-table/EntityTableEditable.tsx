import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
import type { EntityTableSlateElement, EntityTableWidgetConfig } from './types';

export const ENTITY_TABLE_TYPE = 'EntityTable' as const;

export const entityTableMdxRule = defineLeafMdxRule<EntityTableSlateElement, 'block'>({
  name: ENTITY_TABLE_TYPE,
  mode: 'block',
  fields: [{ key: 'schema' }, { key: 'owner' }, { key: 'lifecycle' }, { key: 'limit' }]
});

export const entityTableMdxConfigSpec: MdxConfigSpec<
  EntityTableSlateElement,
  EntityTableWidgetConfig
> = {
  fromElement: el => ({
    schema: el.schema,
    owner: el.owner,
    lifecycle: el.lifecycle,
    limit: el.limit ? Number(el.limit) : undefined
  }),
  toElement: config => ({
    schema: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    limit: String(config.limit ?? 10)
  })
};

export const EntityTableEditable = (props: PlateElementProps<EntityTableSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={ENTITY_TABLE_TYPE}
    placeholder="Configure entity table…"
    fullWidth
    configSpec={entityTableMdxConfigSpec}
    hasValue={el => !!(el.schema || el.owner || el.lifecycle)}
    previewProps={el => ({
      schema: el.schema ?? '',
      owner: el.owner ?? '',
      lifecycle: el.lifecycle ?? '',
      limit: el.limit ?? ''
    })}
  />
);
