import { getRouteApi } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbTable } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { TbLayoutGrid } from 'react-icons/tb';

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
  const { fieldGroups = [] } = useWorkspaceContext();

  const activeTab =
    search.tab === 'enums' ? 'enums' : search.tab === 'fieldgroups' ? 'fieldgroups' : 'types';
  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;
  const fieldGroupId = search.fieldGroupId ?? null;

  const activateTab = (tab: 'types' | 'enums' | 'fieldgroups') => {
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
          onValueChange={value => activateTab(value as 'types' | 'enums' | 'fieldgroups')}
        >
          <Tabs.List>
            <Tabs.Trigger value="types">Types</Tabs.Trigger>
            <Tabs.Trigger value="enums">Enums</Tabs.Trigger>
            <Tabs.Trigger value="fieldgroups">Fieldgroups</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Entity types</SidebarGroupLabel>
          {schemas.map((s, i) => (
            <TreeRow
              key={s.id}
              testId={`schema-type-${s.name}`}
              icon={
                <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />
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
      ) : activeTab === 'enums' ? (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Enums</SidebarGroupLabel>
          {enums.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No enums defined.</div>
          )}
          {enums.map(e => (
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
      ) : (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Shared fieldgroups</SidebarGroupLabel>
          {fieldGroups.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No fieldgroups defined.</div>
          )}
          {fieldGroups.map(group => (
            <TreeRow
              key={group.id}
              icon={<TbLayoutGrid size={12} />}
              label={group.name}
              active={fieldGroupId === group.id}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/settings/schemas',
                  params: { workspaceSlug },
                  search: { tab: 'fieldgroups', fieldGroupId: group.id }
                })
              }
              trailing={<span className="dim mono">{group.fields.length}</span>}
            />
          ))}
        </div>
      )}
    </>
  );
};
