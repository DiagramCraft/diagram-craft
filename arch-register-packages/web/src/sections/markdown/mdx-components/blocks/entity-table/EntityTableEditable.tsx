import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
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
  width: 460,
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
  }),
  isValidConfig: () => true
};

export const EntityTableEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityTableSlateElement>) => {
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const limit = element.limit ?? '';
  const hasValue = !!(schema || owner || lifecycle);

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<span>Configure entity table…</span>}
      content={
        <MdxComponentPreview type={ENTITY_TABLE_TYPE} props={{ schema, owner, lifecycle, limit }} />
      }
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={!hasValue}
          spec={entityTableMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
