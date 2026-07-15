import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText } from 'react-icons/tb';
import { useRelatedDocumentContent } from '../../../hooks/useDocuments';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { asEntityPublicId, asProjectPublicId, entityMarkdownRoute, projectMarkdownRoute, workspaceMarkdownRoute } from '../../../routes/publicObjectRoutes';

export const EntityRelatedContentTab = ({ workspaceId, entityId }: { workspaceId: string; entityId: string }) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useRelatedDocumentContent(workspaceId, entityId);
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof data>();
    for (const item of data) {
      const key = `${item.document_type_name ?? 'Untyped Markdown'} · ${item.field_name}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [data]);

  if (isLoading) return <LoadingState text="Loading related content…" />;
  if (groups.length === 0) return <EmptyState title="No related typed documents" subtitle="Documents that link to this entity will appear here." />;

  return (
    <div style={{ padding: 20, display: 'grid', gap: 18 }}>
      {groups.map(([label, items]) => (
        <section key={label}>
          <h3 style={{ fontSize: 12, margin: '0 0 8px' }}>{label}</h3>
          <div style={{ display: 'grid', gap: 4 }}>
            {items.map(item => (
              <button
                key={`${item.file.id}:${item.field_id}`}
                type="button"
                onClick={() => navigate(
                  item.scope === 'project'
                    ? projectMarkdownRoute(workspaceId, asProjectPublicId(item.file.project_public_id ?? item.file.project_id!), item.file.id, { mode: 'preview' })
                    : item.scope === 'entity'
                      ? entityMarkdownRoute(workspaceId, asEntityPublicId(entityId), item.file.id, { mode: 'preview' })
                      : workspaceMarkdownRoute(workspaceId, item.file.id, { mode: 'preview' })
                )}
                style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: '1px solid var(--panel-border)', borderRadius: 5, background: 'transparent', color: 'inherit', padding: '8px 10px', cursor: 'pointer' }}
              >
                <TbFileText size={14} />
                <span>{item.file.name}</span>
                <span className="dim" style={{ marginLeft: 'auto', fontSize: 10 }}>{item.file.path}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
