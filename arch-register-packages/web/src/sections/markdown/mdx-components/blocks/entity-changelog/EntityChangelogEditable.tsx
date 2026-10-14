import { type PlateElementProps } from 'platejs/react';
import { defineLeafMdxRule } from '../../leafMdxRule';
import { ConfigurableBlockEditable } from '../ConfigurableBlockEditable';
import type { MdxConfigSpec } from '../MdxWidgetConfigDialog';
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
  })
};

export const EntityChangelogEditable = (props: PlateElementProps<EntityChangelogSlateElement>) => (
  <ConfigurableBlockEditable
    {...props}
    componentType={ENTITY_CHANGELOG_TYPE}
    placeholder="Configure entity changelog…"
    fullWidth
    configSpec={entityChangelogMdxConfigSpec}
    hasValue={el => !!(el.entityId || el.schema || el.owner || el.lifecycle)}
    previewProps={el => ({
      id: el.entityId ?? '',
      schema: el.schema ?? '',
      owner: el.owner ?? '',
      lifecycle: el.lifecycle ?? '',
      limit: el.limit ?? '',
      since: el.since ?? ''
    })}
  />
);
