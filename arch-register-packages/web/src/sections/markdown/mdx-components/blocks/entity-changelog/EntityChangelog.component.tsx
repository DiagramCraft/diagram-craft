import { TbHistory } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { EntityChangelog } from './EntityChangelog';
import {
  ENTITY_CHANGELOG_TYPE,
  EntityChangelogEditable,
  entityChangelogMdxRule
} from './EntityChangelogEditable';
import { EntityChangelogConfigForm } from './EntityChangelogConfigForm';
import type { EntityChangelogSlateElement, EntityChangelogWidgetConfig } from './types';

const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';
export default defineComponent<
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
  type: ENTITY_CHANGELOG_TYPE,
  category: 'data-views',
  name: 'Entity changelog',
  description:
    'A feed of recent changes to one entity or a filtered set. Use it to see what changed lately.',
  dashboardWidget: {
    icon: TbHistory,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    isValidConfig: (config): config is EntityChangelogWidgetConfig =>
      hasOptionalString(config, 'entityId') &&
      hasOptionalString(config, 'schema') &&
      hasOptionalString(config, 'owner') &&
      hasOptionalString(config, 'lifecycle') &&
      hasOptionalString(config, 'limit') &&
      hasOptionalString(config, 'since') &&
      !!(config.entityId || config.schema || config.owner || config.lifecycle),
  },
  component: EntityChangelog,
  createDefaultProps: () => ({ config: { since: '30d', limit: '10' } }),
  configForm: EntityChangelogConfigForm,
  mdxComponent: {
    mode: 'block',
    allowedProps: ['id', 'schema', 'owner', 'lifecycle', 'limit', 'since'],
    mapProps: props => ({
      config: {
        entityId: props.id,
        schema: props.schema,
        owner: props.owner,
        lifecycle: props.lifecycle,
        limit: props.limit,
        since: props.since
      }
    }),
    editorSpec: {
      editableComponent: EntityChangelogEditable,
      nodeOptions: { isVoid: true },
      mdxRule: entityChangelogMdxRule,
      slashCommand: {
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
  }
});
