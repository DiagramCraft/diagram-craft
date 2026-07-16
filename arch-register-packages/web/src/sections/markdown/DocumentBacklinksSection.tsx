import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText, TbLink } from 'react-icons/tb';
import { useDocumentBacklinks } from '../../hooks/useDocuments';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { Chip } from '../../components/Chip';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import styles from './MarkdownEditorScreen.module.css';

export const DocumentBacklinksSection = ({
  workspaceId,
  nodeId
}: {
  workspaceId: string;
  nodeId: string;
}) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useDocumentBacklinks(workspaceId, nodeId);

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

  if (isLoading) return <LoadingState text="Loading backlinks…" />;

  return (
    <section className={styles.discussionSection}>
      <div className={styles.discussionHead}>
        <TbLink size={14} />
        <span className={styles.discussionTitle}>Backlinks</span>
        {data.length > 0 && <span className={styles.discussionCount}>{data.length}</span>}
      </div>
      {groups.length === 0 ? (
        <EmptyState
          title="Nothing links here yet"
          subtitle="Documents that link to this one will appear here."
        />
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {groups.map(([key, group]) => (
            <div key={key}>
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
                  <TreeRow
                    key={`${item.file.id}:${item.field_id}`}
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
                              asProjectPublicId(
                                item.file.project_public_id ?? item.file.project_id!
                              ),
                              item.file.id,
                              { mode: 'preview' }
                            )
                          : item.scope === 'entity'
                            ? entityMarkdownRoute(
                                workspaceId,
                                asEntityPublicId(item.file.entity_id!),
                                item.file.id,
                                { mode: 'preview' }
                              )
                            : workspaceMarkdownRoute(workspaceId, item.file.id, { mode: 'preview' })
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
