import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText } from 'react-icons/tb';
import { useRelatedDocumentContent } from '../../../hooks/useDocuments';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Table } from '../../../components/table/Table';
import { TypeBadge } from '../../../components/TypeBadge';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../../routes/publicObjectRoutes';

const SCOPE_LABEL = { project: 'Project', entity: 'Entity', workspace: 'Workspace' } as const;

export const EntityRelatedContentTab = ({
  workspaceId,
  entityId
}: {
  workspaceId: string;
  entityId: string;
}) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = useRelatedDocumentContent(workspaceId, entityId);

  const rows = useMemo(
    () =>
      data
        .map(item => ({
          item,
          typeName: item.document_type_name ?? 'Untyped Markdown',
          fieldName: item.field_inverse_name ?? item.field_name
        }))
        .sort(
          (a, b) =>
            a.typeName.localeCompare(b.typeName) ||
            a.fieldName.localeCompare(b.fieldName) ||
            a.item.file.name.localeCompare(b.item.file.name)
        ),
    [data]
  );

  if (isLoading) return <LoadingState text="Loading related content…" />;
  if (rows.length === 0)
    return (
      <EmptyState
        dense
        title="No related typed documents"
        subtitle="Documents that link to this entity will appear here."
      />
    );

  const open = (item: (typeof data)[number]) =>
    navigate(
      item.scope === 'project'
        ? projectMarkdownRoute(
            workspaceId,
            asProjectPublicId(item.file.project_public_id ?? item.file.project_id!),
            item.file.id,
            { mode: 'preview' }
          )
        : item.scope === 'entity'
          ? entityMarkdownRoute(workspaceId, asEntityPublicId(entityId), item.file.id, {
              mode: 'preview'
            })
          : workspaceMarkdownRoute(workspaceId, item.file.id, { mode: 'preview' })
    );

  return (
    <div style={{ padding: '16px 24px 32px' }}>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Relation</Table.HeaderCell>
            <Table.HeaderCell>Scope</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map(({ item, typeName, fieldName }) => (
            <Table.Row key={`${item.file.id}:${item.field_id}`} onClick={() => open(item)}>
              <Table.NameCell
                icon={<TbFileText size={14} />}
                title={item.file.name}
                subtitle={item.file.path}
              />
              <Table.Cell>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TypeBadge
                    color={item.document_type_color ?? 'var(--base-fg-dim)'}
                    name={typeName}
                    icon={item.document_type_icon}
                    size={16}
                  />
                  {typeName}
                </span>
              </Table.Cell>
              <Table.Cell>{fieldName}</Table.Cell>
              <Table.Cell>{SCOPE_LABEL[item.scope]}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
