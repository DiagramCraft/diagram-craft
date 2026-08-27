import { getRouteApi } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbTable } from 'react-icons/tb';
import { groupSchemasByCategory, resolveSchemaColor } from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { TbLayoutGrid } from 'react-icons/tb';

type SchemaSettingsTab = 'types' | 'enums' | 'fieldgroups' | 'relation-types';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

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
  const { fieldGroups = [], relationSchemas } = useWorkspaceContext();

  const activeTab: SchemaSettingsTab =
    search.tab === 'enums'
      ? 'enums'
      : search.tab === 'fieldgroups'
        ? 'fieldgroups'
        : search.tab === 'relation-types'
          ? 'relation-types'
          : 'types';
  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;
  const fieldGroupId = search.fieldGroupId ?? null;
  const relationSchemaId = search.relationSchema ?? null;
  const schemaGroups = groupSchemasByCategory(schemas);
  const relationSchemaGroups = groupSchemasByCategory(relationSchemas);
  const enumGroups = groupSchemasByCategory(enums);
  const fieldGroupGroups = groupSchemasByCategory(fieldGroups);

  const activateTab = (tab: SchemaSettingsTab) => {
    navigate({
      to: '/$workspaceSlug/settings/schemas',
      params: { workspaceSlug },
      search: { tab }
    });
  };

  return (
    <>
      <SidebarHeader>
        <Tabs.Root
          value={activeTab}
          onValueChange={value => activateTab(value as SchemaSettingsTab)}
        >
          <Tabs.List>
            <Tabs.Trigger value="types">Type</Tabs.Trigger>
            <Tabs.Trigger value="relation-types">Relation</Tabs.Trigger>
            <Tabs.Trigger value="enums">Enum</Tabs.Trigger>
            <Tabs.Trigger value="fieldgroups">Group</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          {schemaGroups.map(group => (
            <div key={group.category}>
              <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
              {group.items.map(({ schema: s, index: i }) => (
                <TreeRow
                  key={s.id}
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
            </div>
          ))}
        </div>
      ) : activeTab === 'relation-types' ? (
        <div className={styles.scroll}>
          {relationSchemas.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No relation types defined.</div>
          )}
          {relationSchemaGroups.map(group => (
            <div key={group.category}>
              <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
              {group.items.map(({ schema: s, index: i }) => (
                <TreeRow
                  key={s.id}
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
            </div>
          ))}
        </div>
      ) : activeTab === 'enums' ? (
        <div className={styles.scroll}>
          {enums.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No enums defined.</div>
          )}
          {enumGroups.map(group => (
            <div key={group.category}>
              <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
              {group.items.map(({ schema: e }) => (
                <TreeRow
                  key={e.id}
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
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.scroll}>
          {fieldGroups.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No fieldgroups defined.</div>
          )}
          {fieldGroupGroups.map(group => (
            <div key={group.category}>
              <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
              {group.items.map(({ schema: fg }) => (
                <TreeRow
                  key={fg.id}
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
            </div>
          ))}
        </div>
      )}
    </>
  );
};
