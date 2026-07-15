import { getRouteApi } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import { resolveDocumentTypeColor } from '../../lib/schemaPresentation';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import styles from '../../shell/SidePanel.module.css';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');

export const DocumentSettingsSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const activeTab = search.tab === 'templates' ? 'templates' : 'types';
  const typeId = search.type ?? null;
  const templateId = search.template ?? null;

  const { data: types = [] } = useDocumentTypes(workspaceSlug, true);
  const { data: templates = [] } = useDocumentTemplates(workspaceSlug, null, true);

  const typeColor = new Map<string, string>(types.map((type, index) => [type.id, resolveDocumentTypeColor(type, index)]));

  const activateTab = (tab: 'types' | 'templates') => {
    navigate({
      to: '/$workspaceSlug/settings/documents',
      params: { workspaceSlug },
      search: { tab }
    });
  };

  const selectType = (id: string) =>
    navigate({
      to: '/$workspaceSlug/settings/documents',
      params: { workspaceSlug },
      search: { tab: 'types', type: id }
    });

  const selectTemplate = (id: string) =>
    navigate({
      to: '/$workspaceSlug/settings/documents',
      params: { workspaceSlug },
      search: { tab: 'templates', template: id }
    });

  const activeTypes = types.filter(type => !type.archived);
  const archivedTypes = types.filter(type => type.archived);
  const activeTemplates = templates.filter(template => !template.archived);
  const archivedTemplates = templates.filter(template => template.archived);

  return (
    <>
      <SidebarHeader>
        <Tabs.Root value={activeTab} onValueChange={value => activateTab(value as 'types' | 'templates')}>
          <Tabs.List>
            <Tabs.Trigger value="types">Types</Tabs.Trigger>
            <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Document types</SidebarGroupLabel>
          {activeTypes.length === 0 && <div className={`${styles.emptyState} dim`}>No document types defined.</div>}
          {activeTypes.map(type => (
            <TreeRow
              key={type.id}
              testId={`document-type-${type.name}`}
              icon={<TypeBadge color={typeColor.get(type.id) ?? 'var(--base-fg-dim)'} name={type.name} icon={type.icon} size={14} />}
              label={type.name}
              active={typeId === type.id}
              onClick={() => selectType(type.id)}
              tagColor={typeColor.get(type.id)}
              trailing={<span className="dim mono">{type.fields.filter(field => !field.retired).length}</span>}
            />
          ))}
          {archivedTypes.length > 0 && (
            <>
              <SidebarGroupLabel>Archived</SidebarGroupLabel>
              {archivedTypes.map(type => (
                <TreeRow
                  key={type.id}
                  icon={<TypeBadge color={typeColor.get(type.id) ?? 'var(--base-fg-dim)'} name={type.name} icon={type.icon} size={14} />}
                  label={type.name}
                  active={typeId === type.id}
                  onClick={() => selectType(type.id)}
                  tagColor={typeColor.get(type.id)}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Templates</SidebarGroupLabel>
          {activeTemplates.length === 0 && <div className={`${styles.emptyState} dim`}>No templates defined.</div>}
          {activeTemplates.map(template => (
            <TreeRow
              key={template.id}
              label={template.name}
              active={templateId === template.id}
              onClick={() => selectTemplate(template.id)}
              tagColor={typeColor.get(template.document_type_id)}
              icon={(() => {
                const type = types.find(item => item.id === template.document_type_id);
                return type ? <TypeBadge color={typeColor.get(type.id) ?? 'var(--base-fg-dim)'} name={type.name} icon={type.icon} size={14} /> : undefined;
              })()}
              trailing={<span className="dim">{types.find(type => type.id === template.document_type_id)?.name ?? 'Unknown'}</span>}
            />
          ))}
          {archivedTemplates.length > 0 && (
            <>
              <SidebarGroupLabel>Archived</SidebarGroupLabel>
              {archivedTemplates.map(template => {
                const type = types.find(item => item.id === template.document_type_id);
                return (
                  <TreeRow
                    key={template.id}
                    label={template.name}
                    active={templateId === template.id}
                    onClick={() => selectTemplate(template.id)}
                    tagColor={type ? typeColor.get(type.id) : undefined}
                    icon={type ? <TypeBadge color={typeColor.get(type.id) ?? 'var(--base-fg-dim)'} name={type.name} icon={type.icon} size={14} /> : undefined}
                    trailing={<span className="dim">{type?.name ?? 'Unknown'}</span>}
                  />
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
};
