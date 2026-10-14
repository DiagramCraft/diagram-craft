import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { BaseBlockEditable } from '../BaseBlockEditable';
import { MdxWidgetConfigDialog, type MdxConfigSpec } from '../MdxWidgetConfigDialog';
import { MdxComponentPreview } from '../../MdxComponentPreview';
import type { EntityChangelogSlateElement, EntityChangelogWidgetConfig } from './types';

export const ENTITY_CHANGELOG_TYPE = 'EntityChangelog' as const;

export const entityChangelogMdxRule = defineLeafMdxRule<EntityChangelogSlateElement, 'block'>({
  name: ENTITY_CHANGELOG_TYPE,
  mode: 'block',
  fields: [
    { key: 'entityId', attr: 'id' },
    { key: 'schema' },
    { key: 'owner' },
    { key: 'lifecycle' },
    { key: 'limit' },
    { key: 'since' }
  ]
});

export const entityChangelogMdxConfigSpec: MdxConfigSpec<
  EntityChangelogSlateElement,
  EntityChangelogWidgetConfig
> = {
  width: 460,
  fromElement: el => ({
    entityId: el.entityId,
    schema: el.schema,
    owner: el.owner,
    lifecycle: el.lifecycle,
    limit: el.limit ?? '10',
    since: el.since ?? '30d'
  }),
  toElement: config => ({
    entityId: config.entityId ?? '',
    schema: config.schema ?? '',
    owner: config.owner ?? '',
    lifecycle: config.lifecycle ?? '',
    limit: config.limit,
    since: config.since
  }),
  isValidConfig: config => !!(config.entityId || config.schema || config.owner || config.lifecycle)
};

export const EntityChangelogEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<EntityChangelogSlateElement>) => {
  const entityId = element.entityId ?? '';
  const schema = element.schema ?? '';
  const owner = element.owner ?? '';
  const lifecycle = element.lifecycle ?? '';
  const limit = element.limit ?? '';
  const since = element.since ?? '';

  const hasValue = !!(entityId || schema || owner || lifecycle);
  const isNew = !hasValue;

  return (
    <BaseBlockEditable
      element={element}
      hasValue={hasValue}
      fullWidth
      placeholder={<span>Configure entity changelog…</span>}
      content={
        <MdxComponentPreview
          type={ENTITY_CHANGELOG_TYPE}
          props={{
            id: entityId ?? '',
            schema: schema ?? '',
            owner: owner ?? '',
            lifecycle: lifecycle ?? '',
            limit: limit ?? '',
            since: since ?? ''
          }}
        />
      }
      dialog={(open, onClose) => (
        <MdxWidgetConfigDialog
          element={element}
          open={open}
          onClose={onClose}
          isNew={isNew}
          spec={entityChangelogMdxConfigSpec}
        />
      )}
      {...props}
    >
      {children}
    </BaseBlockEditable>
  );
};
