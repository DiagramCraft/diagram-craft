import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import {
  TbDatabase,
  TbTable,
  TbLayoutGrid,
  TbPlus,
  TbShare2,
  TbPencil,
  TbTrash
} from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  compareSchemaCategories,
  groupSchemasByCategory,
  resolveSchemaColor,
  UNCATEGORIZED_SCHEMA_CATEGORY
} from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import { RenameDialog } from '../../components/RenameDialog';
import { AddCategoryDialog } from './AddCategoryDialog';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Category } from '@arch-register/api-types/categoryContract';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../hooks/useCategories';
import { NEW_SCHEMA_ID } from './SchemaSettingsScreen';
import { NEW_RELATION_SCHEMA_ID } from './RelationSchemaSettingsScreen';
import { NEW_ENUM_ID } from './EnumEditorScreen';
import { NEW_FIELD_GROUP_ID } from './FieldGroupEditorScreen';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const categoryLabelStyle = { color: 'var(--base-fg)' };

// A row for the sidebar's category headers: `id: null` is the synthetic Uncategorized bucket,
// never a real workspace_category row, so it can't be renamed or deleted.
type CategoryRow = { id: string | null; name: string };

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
  const { fieldGroups = [], relationSchemas, permissions, categories } = useWorkspaceContext();
  const createCategoryMutation = useCreateCategory(workspaceSlug);
  const updateCategoryMutation = useUpdateCategory(workspaceSlug);
  const deleteCategoryMutation = useDeleteCategory(workspaceSlug);

  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;
  const fieldGroupId = search.fieldGroupId ?? null;
  const relationSchemaId = search.relationSchema ?? null;

  const schemaGroups = groupSchemasByCategory(schemas);
  const relationSchemaGroups = groupSchemasByCategory(relationSchemas);
  const enumGroups = groupSchemasByCategory(enums);
  const fieldGroupGroups = groupSchemasByCategory(fieldGroups);

  const hasUncategorizedItems = [
    ...schemaGroups,
    ...relationSchemaGroups,
    ...enumGroups,
    ...fieldGroupGroups
  ].some(group => group.categoryId === null);

  const categoryRows: CategoryRow[] = [
    ...[...categories]
      .sort((left, right) => compareSchemaCategories(left.name, right.name))
      .map(category => ({ id: category.id, name: category.name })),
    ...(hasUncategorizedItems ? [{ id: null, name: UNCATEGORIZED_SCHEMA_CATEGORY }] : [])
  ];

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCategory = (categoryKey: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  };

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categoryMenu, setCategoryMenu] = useState<{
    x: number;
    y: number;
    category: Category;
  } | null>(null);
  const [renameCategoryTarget, setRenameCategoryTarget] = useState<Category | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);

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
                <Menu.Separator />
                <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => setAddCategoryOpen(true)}>
                  Add category
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : undefined
        }
      />
      <div className={styles.scroll}>
        {isEmpty && categoryRows.length === 0 && (
          <div className={`${styles.emptyState} dim`}>No schemas defined.</div>
        )}
        {categoryRows.map(category => {
          const entityItems = schemaGroups.find(g => g.categoryId === category.id)?.items ?? [];
          const enumItems = enumGroups.find(g => g.categoryId === category.id)?.items ?? [];
          const fieldGroupItems =
            fieldGroupGroups.find(g => g.categoryId === category.id)?.items ?? [];
          const relationItems =
            relationSchemaGroups.find(g => g.categoryId === category.id)?.items ?? [];
          const itemCount =
            entityItems.length + enumItems.length + fieldGroupItems.length + relationItems.length;
          const categoryKey = category.id ?? '';
          const expanded = !collapsed.has(categoryKey);

          return (
            <div
              key={categoryKey}
              style={{
                borderBottom: '1px solid var(--panel-border)',
                paddingBottom: '0.25rem',
                paddingTop: '0.25rem'
              }}
            >
              <TreeRow
                label={category.name}
                expandable
                expanded={expanded}
                chevronPosition="end"
                hideIconSlot
                labelStyle={categoryLabelStyle}
                onExpand={() => toggleCategory(categoryKey)}
                onClick={() => toggleCategory(categoryKey)}
                onContextMenu={event => {
                  if (!permissions.canEditSchemas || category.id === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const fullCategory = categories.find(c => c.id === category.id);
                  if (!fullCategory) return;
                  setCategoryMenu({ x: event.clientX, y: event.clientY, category: fullCategory });
                }}
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
                  {itemCount === 0 && (
                    <div className={`${styles.emptyState} dim`} style={{ paddingLeft: '1.5rem' }}>
                      Empty
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddCategoryDialog
        open={addCategoryOpen}
        onAdd={name => {
          createCategoryMutation.mutate(name);
          setAddCategoryOpen(false);
        }}
        onCancel={() => setAddCategoryOpen(false)}
      />

      {categoryMenu && (
        <ContextMenu.Imperative
          x={categoryMenu.x}
          y={categoryMenu.y}
          onClose={() => setCategoryMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            onClick={() => setRenameCategoryTarget(categoryMenu.category)}
          >
            Rename
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            disabled={
              (schemaGroups.find(g => g.categoryId === categoryMenu.category.id)?.items.length ??
                0) +
                (enumGroups.find(g => g.categoryId === categoryMenu.category.id)?.items.length ??
                  0) +
                (fieldGroupGroups.find(g => g.categoryId === categoryMenu.category.id)?.items
                  .length ?? 0) +
                (relationSchemaGroups.find(g => g.categoryId === categoryMenu.category.id)?.items
                  .length ?? 0) >
              0
            }
            leftSlot={<TbTrash size={13} />}
            onClick={() => setDeleteCategoryTarget(categoryMenu.category)}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      {renameCategoryTarget && (
        <RenameDialog
          open={true}
          currentName={renameCategoryTarget.name}
          entityType="category"
          onRename={name => {
            updateCategoryMutation.mutate({ id: renameCategoryTarget.id, name });
            setRenameCategoryTarget(null);
          }}
          onCancel={() => setRenameCategoryTarget(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={!!deleteCategoryTarget}
        title="Delete category?"
        message={
          <>
            The category <b>{deleteCategoryTarget?.name}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete category"
        onConfirm={() => {
          if (deleteCategoryTarget) {
            deleteCategoryMutation.mutate(deleteCategoryTarget.id);
            setDeleteCategoryTarget(null);
          }
        }}
        onCancel={() => setDeleteCategoryTarget(null)}
      />
    </>
  );
};
