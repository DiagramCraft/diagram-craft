import { TbHistory } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityChangelog } from './EntityChangelog';
import { EntityChangelogWidget } from '../../../../dashboard/widgets/EntityChangelogWidget';
import {
  ENTITY_CHANGELOG_TYPE,
  EntityChangelogEditable,
  entityChangelogMdxRule
} from './EntityChangelogEditable';
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
    component: EntityChangelogWidget,
    isValidConfig: (config): config is EntityChangelogWidgetConfig =>
      hasOptionalString(config, 'entityId') &&
      hasOptionalString(config, 'schema') &&
      hasOptionalString(config, 'owner') &&
      hasOptionalString(config, 'lifecycle') &&
      hasOptionalString(config, 'limit') &&
      hasOptionalString(config, 'since'),
    createDefaultConfig: () => ({ since: '30d', limit: '10' }),
    getTitle: () => 'Entity changelog'
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
