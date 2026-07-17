import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbFileText } from 'react-icons/tb';
import type { DocumentField, DocumentType } from '@arch-register/api-types/documentContract';
import type { DocumentListItem } from '@arch-register/api-types/projectContract';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { useDocumentList, useDocumentTypes } from '../../../../../hooks/useDocuments';
import { useEntity } from '../../../../../hooks/useEntities';
import { EmptyState } from '../../../../../components/EmptyState';
import { Table } from '../../../../../components/table/Table';
import { TypeBadge } from '../../../../../components/TypeBadge';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../../../../routes/publicObjectRoutes';
import { decodeDocumentBrowserEmbedConfig } from './DocumentBrowserEmbedCodec';
import { DOCUMENT_BROWSER_BASE_COLUMN_IDS, type DocumentBrowserScope } from './types';
import styles from './DocumentBrowserEmbed.module.css';

type Props = {
  config?: string;
};

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

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

export const DocumentBrowserEmbed = ({ config: rawConfig }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, projects } = useWorkspaceContext();
  const { projectId, entityId } = useMdxContext();
  const config = useMemo(() => decodeDocumentBrowserEmbedConfig(rawConfig), [rawConfig]);
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
  const visibleBaseColumnIds = new Set(
    config?.visibleBaseColumnIds ?? DOCUMENT_BROWSER_BASE_COLUMN_IDS
  );

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
      <Table.Root className={styles.tableSurface}>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Title</Table.HeaderCell>
            {visibleBaseColumnIds.has('document_type') && (
              <Table.HeaderCell>Document type</Table.HeaderCell>
            )}
            {visibleBaseColumnIds.has('location') && <Table.HeaderCell>Location</Table.HeaderCell>}
            {visibleBaseColumnIds.has('updated_at') && <Table.HeaderCell>Updated</Table.HeaderCell>}
            {visibleFields.map(field => (
              <Table.HeaderCell key={field.id}>{field.name}</Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {documents.map(document => (
            <Table.Row
              key={document.file.id}
              onClick={() => onDocumentClick(document)}
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') onDocumentClick(document);
              }}
            >
              <Table.NameCell
                icon={<TbFileText size={16} />}
                title={document.file.name}
                subtitle={document.file.path}
              />
              {visibleBaseColumnIds.has('document_type') && (
                <Table.Cell>
                  {document.document_type_name ? (
                    <span className={styles.typeCell}>
                      <TypeBadge
                        color={document.document_type_color ?? 'var(--base-fg-dim)'}
                        name={document.document_type_name}
                        icon={document.document_type_icon}
                        size={18}
                      />
                      {document.document_type_name}
                    </span>
                  ) : (
                    'Untyped Markdown'
                  )}
                </Table.Cell>
              )}
              {visibleBaseColumnIds.has('location') && <Table.Cell>{locationLabel}</Table.Cell>}
              {visibleBaseColumnIds.has('updated_at') && (
                <Table.Cell>{formatDate(document.file.updated_at)}</Table.Cell>
              )}
              {visibleFields.map(field => (
                <Table.Cell key={field.id}>{displayValue(document.metadata[field.id])}</Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
};

export type { DocumentBrowserEmbedConfig } from './types';
