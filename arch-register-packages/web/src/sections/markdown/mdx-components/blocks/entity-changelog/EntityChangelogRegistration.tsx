import { TbHistory } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityChangelog } from './EntityChangelog';
import { createDashboardWidgetAdapter } from '../../../../dashboard/widgets/createDashboardWidgetAdapter';
import {
  ENTITY_CHANGELOG_TYPE,
  EntityChangelogEditable,
  entityChangelogMdxRule
} from './EntityChangelogEditable';
import { EntityChangelogConfigForm } from './EntityChangelogConfigForm';
import type { EntityChangelogSlateElement, EntityChangelogWidgetConfig } from './types';

const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';

export const entityChangelogSpec = defineMdxComponent<
  EntityChangelogSlateElement,
  {
    id?: string;
    schema?: string;
    owner?: string;
    lifecycle?: string;
    limit?: string;
    since?: string;
  },
  'block'
>({
  component: EntityChangelog,
  mode: 'block',
  allowedProps: ['id', 'schema', 'owner', 'lifecycle', 'limit', 'since'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbHistory,
    label: 'Entity changelog',
    description: 'A recent-changes feed for one entity or a filtered set.',
    defaultW: 6,
    defaultH: 4,
    surfaces: ['workspace', 'project'],
    component: createDashboardWidgetAdapter(
      EntityChangelog,
      (config: EntityChangelogWidgetConfig) => ({
        id: config.entityId,
        schema: config.schema,
        owner: config.owner,
        lifecycle: config.lifecycle,
        limit: config.limit,
        since: config.since
      })
    ),
    isValidConfig: (config): config is EntityChangelogWidgetConfig =>
      hasOptionalString(config, 'entityId') &&
      hasOptionalString(config, 'schema') &&
      hasOptionalString(config, 'owner') &&
      hasOptionalString(config, 'lifecycle') &&
      hasOptionalString(config, 'limit') &&
      hasOptionalString(config, 'since') &&
      !!(config.entityId || config.schema || config.owner || config.lifecycle),
    createDefaultConfig: () => ({ since: '30d', limit: '10' }),
    getTitle: () => 'Entity changelog',
    configForm: EntityChangelogConfigForm
  },
  editorSpec: {
    editableComponent: EntityChangelogEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityChangelogMdxRule,
    slashCommand: {
      key: 'entity-changelog',
      label: 'Entity Changelog',
      description: 'Embed a live feed of recent entity changes',
      icon: <TbHistory size={14} />,
      keywords: ['changelog', 'audit', 'history', 'changes', 'entity'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_CHANGELOG_TYPE,
          entityId: '',
          schema: '',
          owner: '',
          lifecycle: '',
          limit: '',
          since: '30d',
          children: [{ text: '' }]
        });
      }
    }
  }
});
