import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText } from 'react-icons/tb';
import { useRelatedDocumentContent } from '../../../hooks/useDocuments';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Chip } from '../../../components/Chip';
import { TreeRow } from '../../../components/TreeRow';
import { TypeBadge } from '../../../components/TypeBadge';
import { HoverCard } from '../../../components/HoverCard';
import hoverCardStyles from '../../../components/HoverCard.module.css';
import { DocumentHoverCardBody } from '../../../components/DocumentHoverCardBody';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../../routes/publicObjectRoutes';

export const EntityRelatedContentTab = ({
  workspaceId,
  entityId
}: {
  workspaceId: string;
  entityId: string;
}) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useRelatedDocumentContent(workspaceId, entityId);
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        typeName: string;
        typeColor: string | null;
        typeIcon: string | null;
        fieldName: string;
        items: typeof data;
      }
    >();
    for (const item of data) {
      const typeName = item.document_type_name ?? 'Untyped Markdown';
      const fieldName = item.field_inverse_name ?? item.field_name;
      const key = `${typeName} · ${fieldName}`;
      const existing = grouped.get(key);
      if (existing) existing.items.push(item);
      else
        grouped.set(key, {
          typeName,
          typeColor: item.document_type_color,
          typeIcon: item.document_type_icon,
          fieldName,
          items: [item]
        });
    }
    return [...grouped.entries()];
  }, [data]);

  if (isLoading) return <LoadingState text="Loading related content…" />;
  if (groups.length === 0)
    return (
      <EmptyState
        title="No related typed documents"
        subtitle="Documents that link to this entity will appear here."
      />
    );

  return (
    <div style={{ padding: 20, display: 'grid', gap: 18 }}>
      {groups.map(([key, group]) => (
        <section key={key}>
          <h3
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              margin: '0 0 8px'
            }}
          >
            <TypeBadge
              color={group.typeColor ?? 'var(--base-fg-dim)'}
              name={group.typeName}
              icon={group.typeIcon}
              size={18}
            />
            <Chip tone="ghost">{group.typeName}</Chip>
            <span className="dim">{group.fieldName}</span>
          </h3>
          <div style={{ display: 'grid', gap: 2 }}>
            {group.items.map(item => (
              <HoverCard
                key={`${item.file.id}:${item.field_id}`}
                anchorClassName={hoverCardStyles.blockAnchor}
                content={
                  <DocumentHoverCardBody
                    name={item.file.name}
                    path={item.file.path}
                    documentTypeName={item.document_type_name}
                    documentTypeColor={item.document_type_color}
                    commentCount={item.file.comment_count}
                    unresolvedCommentCount={item.file.unresolved_comment_count}
                  />
                }
              >
                <TreeRow
                  icon={<TbFileText size={14} />}
                  label={item.file.name}
                  trailing={
                    <span className="dim" style={{ fontSize: 10 }}>
                      {item.file.path}
                    </span>
                  }
                  onClick={() =>
                    navigate(
                      item.scope === 'project'
                        ? projectMarkdownRoute(
                            workspaceId,
                            asProjectPublicId(item.file.project_public_id ?? item.file.project_id!),
                            item.file.id,
                            { mode: 'preview' }
                          )
                        : item.scope === 'entity'
                          ? entityMarkdownRoute(
                              workspaceId,
                              asEntityPublicId(entityId),
                              item.file.id,
                              { mode: 'preview' }
                            )
                          : workspaceMarkdownRoute(workspaceId, item.file.id, { mode: 'preview' })
                    )
                  }
                />
              </HoverCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
