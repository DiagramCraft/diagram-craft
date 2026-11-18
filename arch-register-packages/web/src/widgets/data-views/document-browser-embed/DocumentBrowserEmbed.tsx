import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText } from 'react-icons/tb';
import type { DocumentField, DocumentType } from '@arch-register/api-types/documentContract';
import type { DocumentListItem } from '@arch-register/api-types/projectDocumentDiscoveryContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useDocumentList, useDocumentTypes } from '../../../hooks/useDocuments';
import { useEntity } from '../../../hooks/useEntities';
import { EmptyState } from '../../../components/EmptyState';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { NameCell } from '../../../components/table/NameCell';
import { TypeBadge } from '../../../components/TypeBadge';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../../routes/publicObjectRoutes';
import {
  DOCUMENT_BROWSER_BASE_COLUMN_IDS,
  type DocumentBrowserEmbedConfig,
  type DocumentBrowserScope
} from './types';
import { formatDate } from '../../../utils/dateFormat';
import styles from './DocumentBrowserEmbed.module.css';

type Props = { config: DocumentBrowserEmbedConfig };

export const resolveDocumentBrowserScope = (
  projectId?: string,
  entityId?: string
): DocumentBrowserScope =>
  projectId
    ? { scope: 'project', projectId }
    : entityId
      ? { scope: 'entity', entityId }
      : { scope: 'workspace' };

const displayValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value == null || value === '' ? '—' : String(value);
};

const getLocationLabel = ({
  scope,
  projectName,
  projectId,
  entityName,
  entityId
}: DocumentBrowserScope & {
  projectName?: string;
  entityName?: string;
}) => {
  if (scope === 'project') return `Project: ${projectName ?? projectId ?? 'Project'}`;
  if (scope === 'entity') return `Entity: ${entityName ?? entityId ?? 'Entity'}`;
  return 'Workspace';
};

const fieldsById = (documentTypes: DocumentType[]) => {
  const result = new Map<string, DocumentField>();
  for (const type of documentTypes) {
    for (const field of type.fields) {
      if (!field.retired) result.set(field.id, field);
    }
  }
  return result;
};

export const DocumentBrowserEmbed = ({ config }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, projects } = useWorkspaceContext();
  const { projectId, entityId } = useMdxContext();
  const scope = useMemo(
    () => resolveDocumentBrowserScope(projectId, entityId),
    [projectId, entityId]
  );
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');

  const project = projects.find(item => item.id === projectId || item.public_id === projectId);
  const locationLabel = getLocationLabel({
    ...scope,
    projectName: project?.name,
    entityName: entity?._name
  });

  const options = useMemo(
    () => ({
      q: config?.q ?? '',
      scope: scope.scope,
      projectId: scope.projectId,
      entityId: scope.entityId,
      documentTypeId: config?.documentTypeId,
      conditions: config?.conditions ?? [],
      sort: config?.sort ?? 'updated_at',
      sortDir: config?.sortDir ?? ('desc' as const),
      limit: 100
    }),
    [config, scope]
  );
  const {
    data: documents = [],
    isLoading,
    isError
  } = useDocumentList(workspaceSlug, options, {
    enabled: !!workspaceSlug && !!config
  });

  const fieldMap = useMemo(() => fieldsById(documentTypes), [documentTypes]);
  const visibleFields = useMemo(
    () =>
      (config?.visibleFieldIds ?? [])
        .map(id => fieldMap.get(id))
        .filter((field): field is DocumentField => !!field),
    [config?.visibleFieldIds, fieldMap]
  );
  const visibleBaseColumnIds = useMemo(
    () => new Set<string>(config?.visibleBaseColumnIds ?? DOCUMENT_BROWSER_BASE_COLUMN_IDS),
    [config?.visibleBaseColumnIds]
  );

  const columns = useMemo(() => {
    const result: DataTableColumn<DocumentListItem>[] = [
      {
        id: 'title',
        header: 'Title',
        size: 320,
        minSize: 160,
        meta: { primary: true },
        cell: ({ row }) => (
          <NameCell.Content
            icon={<TbFileText size={16} />}
            title={row.original.file.name}
            subtitle={row.original.file.path}
          />
        )
      }
    ];
    if (visibleBaseColumnIds.has('document_type')) {
      result.push({
        id: 'document_type',
        header: 'Document type',
        size: 180,
        minSize: 100,
        cell: ({ row }) =>
          row.original.document_type_name ? (
            <span className={styles.typeCell}>
              <TypeBadge
                color={row.original.document_type_color ?? 'var(--base-fg-secondary)'}
                name={row.original.document_type_name}
                icon={row.original.document_type_icon}
                size={18}
              />
              {row.original.document_type_name}
            </span>
          ) : (
            'Untyped Markdown'
          )
      });
    }
    if (visibleBaseColumnIds.has('location')) {
      result.push({
        id: 'location',
        header: 'Location',
        size: 160,
        minSize: 80,
        cell: () => locationLabel
      });
    }
    if (visibleBaseColumnIds.has('updated_at')) {
      result.push({
        id: 'updated_at',
        header: 'Updated',
        size: 140,
        minSize: 80,
        cell: ({ row }) => formatDate(row.original.file.updated_at)
      });
    }
    for (const field of visibleFields) {
      result.push({
        id: `field:${field.id}`,
        header: field.name,
        size: 160,
        minSize: 80,
        cell: ({ row }) => displayValue(row.original.metadata[field.id])
      });
    }
    return result;
  }, [visibleBaseColumnIds, visibleFields, locationLabel]);

  const onDocumentClick = useCallback(
    (document: DocumentListItem) => {
      const route =
        scope.scope === 'project'
          ? projectMarkdownRoute(
              workspaceSlug,
              asProjectPublicId(document.file.project_public_id ?? projectId!),
              document.file.id,
              { mode: 'preview' }
            )
          : scope.scope === 'entity'
            ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId!), document.file.id, {
                mode: 'preview'
              })
            : workspaceMarkdownRoute(workspaceSlug, document.file.id, { mode: 'preview' });
      void navigate(route);
    },
    [entityId, navigate, projectId, scope.scope, workspaceSlug]
  );

  if (!config) {
    return (
      <div className={styles.container}>
        <EmptyState compact title="No document browser configured." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (isError || documents.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState
          compact
          title={isError ? 'Unable to load documents.' : 'No documents match the current filters.'}
        />
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <DataTable
        // Remount when the column set changes so local widths don't leak between column sets
        key={columns.map(c => c.id).join('|')}
        scroll
        resizable
        rowKeyboardActivation
        columns={columns}
        data={documents}
        getRowId={document => document.file.id}
        onRowClick={onDocumentClick}
      />
    </div>
  );
};
