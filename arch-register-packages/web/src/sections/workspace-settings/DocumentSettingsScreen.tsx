import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import { LoadingState } from '../../components/LoadingState';
import { resolveDocumentTypeColor } from '../../lib/schemaPresentation';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { DocumentTypeEditor } from './DocumentTypeEditor';
import { DocumentTemplateEditor } from './DocumentTemplateEditor';
import styles from './DocumentSettingsScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');

export const DocumentSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug } = useWorkspaceContext();
  const activeTab = search.tab === 'templates' ? 'templates' : 'types';

  const { data: types = [], isLoading: typesLoading } = useDocumentTypes(workspaceSlug, true);
  const { data: templates = [], isLoading: templatesLoading } = useDocumentTemplates(
    workspaceSlug,
    null,
    true
  );

  const typeColor = useMemo(() => {
    const colors = new Map<string, string>();
    types.forEach((type: DocumentType, index: number) =>
      colors.set(type.id, resolveDocumentTypeColor(type, index))
    );
    return colors;
  }, [types]);

  if (typesLoading || templatesLoading)
    return <LoadingState text="Loading document definitions…" size="sm" />;

  return (
    <div className={styles.screen}>
      {activeTab === 'types' ? (
        <DocumentTypeEditor
          workspaceSlug={workspaceSlug}
          types={types}
          typeColor={typeColor}
          selectedId={search.type ?? null}
          onSelect={id =>
            navigate({
              to: '/$workspaceSlug/settings/documents',
              params: { workspaceSlug },
              search: { tab: 'types', type: id }
            })
          }
        />
      ) : (
        <DocumentTemplateEditor
          workspaceSlug={workspaceSlug}
          templates={templates}
          types={types}
          selectedId={search.template ?? null}
          onSelect={id =>
            navigate({
              to: '/$workspaceSlug/settings/documents',
              params: { workspaceSlug },
              search: { tab: 'templates', template: id }
            })
          }
        />
      )}
    </div>
  );
};
