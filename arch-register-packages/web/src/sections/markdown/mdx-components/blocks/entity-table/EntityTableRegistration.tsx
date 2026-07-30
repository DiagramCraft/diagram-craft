import { TbTable } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { EntityTable } from './EntityTable';
import { EntityTableWidget } from '../../../../dashboard/widgets/EntityTableWidget';
import { ENTITY_TABLE_TYPE, EntityTableEditable, entityTableMdxRule } from './EntityTableEditable';
import { EntityTableConfigForm } from './EntityTableConfigForm';
import type { EntityTableSlateElement, EntityTableWidgetConfig } from './types';

const hasOptionalString = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || typeof config[key] === 'string';

const hasOptionalInteger = (config: Record<string, unknown>, key: string): boolean =>
  config[key] === undefined || (typeof config[key] === 'number' && Number.isInteger(config[key]));

export const entityTableSpec = defineMdxComponent<
  EntityTableSlateElement,
  { schema?: string; owner?: string; lifecycle?: string; limit?: string },
  'block'
>({
  component: EntityTable,
  mode: 'block',
  allowedProps: ['schema', 'owner', 'lifecycle', 'limit'],
  surfaces: ['wiki', 'dashboard'],
  dashboardWidget: {
    icon: TbTable,
    label: 'Entity table',
    description: 'A filtered table of entities.',
    defaultW: 6,
    defaultH: 6,
    surfaces: ['workspace', 'project'],
    component: EntityTableWidget,
    isValidConfig: (config): config is EntityTableWidgetConfig =>
      hasOptionalString(config, 'schema') &&
      hasOptionalString(config, 'owner') &&
      hasOptionalString(config, 'lifecycle') &&
      hasOptionalInteger(config, 'limit'),
    createDefaultConfig: () => ({}),
    configForm: EntityTableConfigForm
  },
  editorSpec: {
    editableComponent: EntityTableEditable,
    nodeOptions: { isVoid: true },
    mdxRule: entityTableMdxRule,
    slashCommand: {
      key: 'entity-table',
      label: 'Entity Table',
      description: 'Embed a live entity table from inline filters',
      icon: <TbTable size={14} />,
      keywords: ['entity', 'table', 'catalog', 'list', 'filter'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: ENTITY_TABLE_TYPE,
          schema: '',
          owner: '',
          lifecycle: '',
          limit: '10',
          children: [{ text: '' }]
        });
      }
    }
  }
});
