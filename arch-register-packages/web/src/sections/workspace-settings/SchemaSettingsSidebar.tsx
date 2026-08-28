import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbDatabase, TbTable, TbLayoutGrid, TbPlus, TbShare2 } from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import {
  compareSchemaCategories,
  groupSchemasByCategory,
  resolveSchemaColor
} from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { NEW_SCHEMA_ID } from './SchemaSettingsScreen';
import { NEW_RELATION_SCHEMA_ID } from './RelationSchemaSettingsScreen';
import { NEW_ENUM_ID } from './EnumEditorScreen';
import { NEW_FIELD_GROUP_ID } from './FieldGroupEditorScreen';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const categoryLabelStyle = { color: 'var(--base-fg)' };

export const SchemaSettingsSidebar = ({
  schemas,
  enums,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  workspaceSlug: string;
}) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { fieldGroups = [], relationSchemas, permissions } = useWorkspaceContext();

  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;
  const fieldGroupId = search.fieldGroupId ?? null;
  const relationSchemaId = search.relationSchema ?? null;

  const schemaGroups = groupSchemasByCategory(schemas);
  const relationSchemaGroups = groupSchemasByCategory(relationSchemas);
  const enumGroups = groupSchemasByCategory(enums);
  const fieldGroupGroups = groupSchemasByCategory(fieldGroups);

  const categories = [
    ...new Set([
      ...schemaGroups.map(g => g.category),
      ...enumGroups.map(g => g.category),
      ...fieldGroupGroups.map(g => g.category),
      ...relationSchemaGroups.map(g => g.category)
    ])
  ].sort(compareSchemaCategories);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCategory = (category: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const createSchema = () =>
    navigate({
      to: '/$workspaceSlug/settings/schemas',
      params: { workspaceSlug },
      search: { tab: 'types', schema: NEW_SCHEMA_ID }
    });

  const createEnum = () =>
    navigate({
      to: '/$workspaceSlug/settings/schemas',
      params: { workspaceSlug },
      search: { tab: 'enums', enumId: NEW_ENUM_ID }
    });

  const createRelationSchema = () =>
    navigate({
      to: '/$workspaceSlug/settings/schemas',
      params: { workspaceSlug },
      search: { tab: 'relation-types', relationSchema: NEW_RELATION_SCHEMA_ID }
    });

  const createFieldGroup = () =>
    navigate({
      to: '/$workspaceSlug/settings/schemas',
      params: { workspaceSlug },
      search: { tab: 'fieldgroups', fieldGroupId: NEW_FIELD_GROUP_ID }
    });

  const isEmpty =
    schemas.length === 0 &&
    enums.length === 0 &&
    fieldGroups.length === 0 &&
    relationSchemas.length === 0;

  return (
    <>
      <SidebarTitleHeader
        title="Schemas"
        actions={
          permissions.canEditSchemas ? (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <button type="button" className={styles.action} title="New">
                    <TbPlus size={13} />
                  </button>
                }
              />
              <MenuButton.Menu>
                <Menu.Item leftSlot={<TbDatabase size={13} />} onClick={createSchema}>
                  Add entity type
                </Menu.Item>
                <Menu.Item leftSlot={<TbTable size={13} />} onClick={createEnum}>
                  Add enum
                </Menu.Item>
                <Menu.Item leftSlot={<TbShare2 size={13} />} onClick={createRelationSchema}>
                  Add relation type
                </Menu.Item>
                <Menu.Item leftSlot={<TbLayoutGrid size={13} />} onClick={createFieldGroup}>
                  Add field group
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : undefined
        }
      />
      <div className={styles.scroll}>
        {isEmpty && <div className={`${styles.emptyState} dim`}>No schemas defined.</div>}
        {categories.map(category => {
          const entityItems = schemaGroups.find(g => g.category === category)?.items ?? [];
          const enumItems = enumGroups.find(g => g.category === category)?.items ?? [];
          const fieldGroupItems = fieldGroupGroups.find(g => g.category === category)?.items ?? [];
          const relationItems =
            relationSchemaGroups.find(g => g.category === category)?.items ?? [];
          const expanded = !collapsed.has(category);

          return (
            <div
              key={category}
              style={{
                borderBottom: '1px solid var(--panel-border)',
                paddingBottom: '0.25rem',
                paddingTop: '0.25rem'
              }}
            >
              <TreeRow
                label={category}
                expandable
                expanded={expanded}
                chevronPosition="end"
                hideIconSlot
                labelStyle={categoryLabelStyle}
                onExpand={() => toggleCategory(category)}
                onClick={() => toggleCategory(category)}
              />
              {expanded && (
                <div>
                  {entityItems.length > 0 && (
                    <>
                      <SidebarGroupLabel>Entity</SidebarGroupLabel>
                      {entityItems.map(({ schema: s, index: i }) => (
                        <TreeRow
                          key={s.id}
                          depth={1}
                          testId={`schema-type-${s.name}`}
                          icon={
                            <TypeBadge
                              color={resolveSchemaColor(s, i)}
                              name={s.name}
                              icon={s.icon}
                              size={14}
                            />
                          }
                          label={s.name}
                          active={schemaId === s.id}
                          onClick={() =>
                            navigate({
                              to: '/$workspaceSlug/settings/schemas',
                              params: { workspaceSlug },
                              search: { tab: 'types', schema: s.id }
                            })
                          }
                          tagColor={resolveSchemaColor(s, i)}
                          trailing={<span className="dim mono">{s.fields.length}</span>}
                        />
                      ))}
                    </>
                  )}
                  {enumItems.length > 0 && (
                    <>
                      <SidebarGroupLabel>Enum</SidebarGroupLabel>
                      {enumItems.map(({ schema: e }) => (
                        <TreeRow
                          key={e.id}
                          depth={1}
                          icon={<TbTable size={12} />}
                          label={e.name}
                          active={enumId === e.id}
                          onClick={() =>
                            navigate({
                              to: '/$workspaceSlug/settings/schemas',
                              params: { workspaceSlug },
                              search: { tab: 'enums', enumId: e.id }
                            })
                          }
                          trailing={<span className="dim mono">{e.options.length}</span>}
                        />
                      ))}
                    </>
                  )}
                  {fieldGroupItems.length > 0 && (
                    <>
                      <SidebarGroupLabel>Field Group</SidebarGroupLabel>
                      {fieldGroupItems.map(({ schema: fg }) => (
                        <TreeRow
                          key={fg.id}
                          depth={1}
                          icon={<TbLayoutGrid size={12} />}
                          label={fg.name}
                          active={fieldGroupId === fg.id}
                          onClick={() =>
                            navigate({
                              to: '/$workspaceSlug/settings/schemas',
                              params: { workspaceSlug },
                              search: { tab: 'fieldgroups', fieldGroupId: fg.id }
                            })
                          }
                          trailing={<span className="dim mono">{fg.fields.length}</span>}
                        />
                      ))}
                    </>
                  )}
                  {relationItems.length > 0 && (
                    <>
                      <SidebarGroupLabel>Relation</SidebarGroupLabel>
                      {relationItems.map(({ schema: s, index: i }) => (
                        <TreeRow
                          key={s.id}
                          depth={1}
                          testId={`relation-schema-type-${s.name}`}
                          icon={
                            <TypeBadge
                              color={resolveSchemaColor(s, i)}
                              name={s.name}
                              icon={s.icon}
                              size={14}
                            />
                          }
                          label={s.name}
                          active={relationSchemaId === s.id}
                          onClick={() =>
                            navigate({
                              to: '/$workspaceSlug/settings/schemas',
                              params: { workspaceSlug },
                              search: { tab: 'relation-types', relationSchema: s.id }
                            })
                          }
                          tagColor={resolveSchemaColor(s, i)}
                          trailing={<span className="dim mono">{s.relation_count}</span>}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
