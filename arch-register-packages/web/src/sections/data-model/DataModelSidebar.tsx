import { useNavigate, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbTable, TbVectorTriangle } from 'react-icons/tb';
import { resolveSchemaColor } from '../../lib/api';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import styles from '../../shell/SidePanel.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);

export const DataModelSidebar = ({
  schemas,
  enums,
  workspaceSlug
}: {
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  workspaceSlug: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    tab?: 'types' | 'enums' | 'graph';
    schema?: string;
    enumId?: string;
  };
  const activeTab = search.tab === 'enums' ? 'enums' : 'types';
  const isGraphOverviewActive = search.tab === 'graph';
  const schemaId = search.schema ?? null;
  const enumId = search.enumId ?? null;

  const activateTab = (tab: 'types' | 'enums') => {
    navigate({
      to: '/$workspaceSlug/model',
      params: { workspaceSlug },
      search: { tab }
    });
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root
          value={activeTab}
          onValueChange={value => activateTab(value as 'types' | 'enums')}
        >
          <Tabs.List>
            <Tabs.Trigger value="types">Types</Tabs.Trigger>
            <Tabs.Trigger value="enums">Enums</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          <GroupLabel>Entity types</GroupLabel>
          {schemas.map((s, i) => (
            <TreeRow
              key={s.id}
              icon={
                <TypeBadge color={resolveSchemaColor(s, i)} name={s.name} icon={s.icon} size={14} />
              }
              label={s.name}
              active={schemaId === s.id}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/model',
                  params: { workspaceSlug },
                  search: { tab: 'types', schema: s.id }
                })
              }
              tagColor={resolveSchemaColor(s, i)}
              trailing={<span className="dim mono">{s.fields.length}</span>}
            />
          ))}
          <GroupLabel>Views</GroupLabel>
          <TreeRow
            icon={<TbVectorTriangle size={12} />}
            label="Graph Overview"
            active={isGraphOverviewActive}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/model',
                params: { workspaceSlug },
                search: { tab: 'graph' }
              })
            }
          />
        </div>
      ) : (
        <div className={styles.scroll}>
          <GroupLabel>Enums</GroupLabel>
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
                  to: '/$workspaceSlug/model',
                  params: { workspaceSlug },
                  search: { tab: 'enums', enumId: e.id }
                })
              }
              trailing={<span className="dim mono">{e.options.length}</span>}
            />
          ))}
        </div>
      )}
    </>
  );
};
