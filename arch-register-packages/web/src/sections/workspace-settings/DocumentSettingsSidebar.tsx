import { Fragment } from 'react';
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

  const typeColor = new Map<string, string>(
    types.map((type, index) => [type.id, resolveDocumentTypeColor(type, index)])
  );

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

  const renderTemplate = (template: (typeof templates)[number], showType: boolean) => {
    const type = types.find(item => item.id === template.document_type_id);
    return (
      <TreeRow
        key={template.id}
        label={template.name}
        active={templateId === template.id}
        onClick={() => selectTemplate(template.id)}
        tagColor={type ? typeColor.get(type.id) : undefined}
        icon={
          type ? (
            <TypeBadge
              color={typeColor.get(type.id) ?? 'var(--base-fg-secondary)'}
              name={type.name}
              icon={type.icon}
              size={14}
            />
          ) : undefined
        }
        trailing={
          showType ? (
            <span className="dim">
              {template.document_type_id === null ? 'Untyped' : (type?.name ?? 'Unknown')}
            </span>
          ) : undefined
        }
      />
    );
  };

  const templateGroups = [
    { id: '__untyped__', name: 'Untyped Markdown' },
    ...activeTypes.map(type => ({ id: type.id, name: type.name })),
    ...(activeTemplates.some(
      t => t.document_type_id !== null && !activeTypes.some(type => type.id === t.document_type_id)
    )
      ? [{ id: '__unknown__', name: 'Unknown type' }]
      : [])
  ]
    .map(group => ({
      ...group,
      templates: activeTemplates.filter(t =>
        group.id === '__untyped__'
          ? t.document_type_id === null
          : group.id === '__unknown__'
            ? t.document_type_id !== null &&
              !activeTypes.some(type => type.id === t.document_type_id)
            : t.document_type_id === group.id
      )
    }))
    .filter(group => group.templates.length > 0);

  return (
    <>
      <SidebarHeader>
        <Tabs.Root
          value={activeTab}
          onValueChange={value => activateTab(value as 'types' | 'templates')}
        >
          <Tabs.List>
            <Tabs.Trigger value="types">Types</Tabs.Trigger>
            <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      {activeTab === 'types' ? (
        <div className={styles.scroll}>
          <SidebarGroupLabel>Document types</SidebarGroupLabel>
          {activeTypes.length === 0 && (
            <div className={`${styles.emptyState} dim`}>No document types defined.</div>
          )}
          {activeTypes.map(type => (
            <TreeRow
              key={type.id}
              testId={`document-type-${type.name}`}
              icon={
                <TypeBadge
                  color={typeColor.get(type.id) ?? 'var(--base-fg-secondary)'}
                  name={type.name}
                  icon={type.icon}
                  size={14}
                />
              }
              label={type.name}
              active={typeId === type.id}
              onClick={() => selectType(type.id)}
              tagColor={typeColor.get(type.id)}
              trailing={
                <span className="dim mono">
                  {type.fields.filter(field => !field.retired).length}
                </span>
              }
            />
          ))}
          {archivedTypes.length > 0 && (
            <>
              <SidebarGroupLabel>Archived</SidebarGroupLabel>
              {archivedTypes.map(type => (
                <TreeRow
                  key={type.id}
                  icon={
                    <TypeBadge
                      color={typeColor.get(type.id) ?? 'var(--base-fg-secondary)'}
                      name={type.name}
                      icon={type.icon}
                      size={14}
                    />
                  }
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
          {activeTemplates.length === 0 && (
            <>
              <SidebarGroupLabel>Templates</SidebarGroupLabel>
              <div className={`${styles.emptyState} dim`}>No templates defined.</div>
            </>
          )}
          {templateGroups.map(group => (
            <Fragment key={group.id}>
              <SidebarGroupLabel>{group.name}</SidebarGroupLabel>
              {group.templates.map(template => renderTemplate(template, false))}
            </Fragment>
          ))}
          {archivedTemplates.length > 0 && (
            <>
              <SidebarGroupLabel>Archived</SidebarGroupLabel>
              {archivedTemplates.map(template => renderTemplate(template, true))}
            </>
          )}
        </div>
      )}
    </>
  );
};
