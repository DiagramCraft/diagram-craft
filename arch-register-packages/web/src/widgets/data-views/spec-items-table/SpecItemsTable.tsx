import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { NameCell } from '../../../components/table/NameCell';
import { useTableSort } from '../../../components/table/useTableSort';
import {
  useSpecificationItemsFeed,
  type SpecificationItemRow
} from '../../../hooks/useSpecificationItemsFeed';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { entitiesQuery } from '../../../queries/entities';
import { stripEmptyGroups } from '../../../sections/entities/components/entityBrowserState';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { resolveEntityQuery } from '../entity-browser-embed/EntityBrowserEmbedFieldResolution';
import styles from './SpecItemsTable.module.css';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import {
  specItemCopyDeprecated,
  specItemCopyMethod,
  specItemCopyPath,
  specItemsEmptyLabel,
  specItemSortValue,
  specItemTone
} from './specItemsTableLogic';
import { SpecItemsTableWidgetConfig } from './types';

const DEFAULT_ENTITY_LIMIT = 200;

type SortKey = 'method' | 'path' | 'entity';

/**
 * A flat, sortable table of operations/messages across the specifications of every entity of a
 * schema in scope. Not tied to any application: any schema with an `api-specification` artifact can
 * be listed, optionally narrowed by a structured filter and/or to deprecated items.
 */
export const SpecItemsTableWidget = ({ config }: { config: SpecItemsTableWidgetConfig }) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
  const framed = useWidgetFramed();
  const { openEntityDrawer } = useEntityDrawer();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const entityQuery = useMemo(
    () =>
      config.entityQuery
        ? stripEmptyGroups(
            resolveEntityQuery(config.entityQuery, schema, schema?.id ?? null, {
              schemas,
              relationSchemas
            })
          )
        : null,
    [config.entityQuery, schema, schemas, relationSchemas]
  );
  const entities = useQuery(
    entitiesQuery(
      workspaceSlug,
      {
        schemaId: schema?.id,
        view: 'summary',
        limit: config.entityLimit ?? DEFAULT_ENTITY_LIMIT,
        entityQuery
      },
      schema != null
    )
  );
  const refs = useMemo(
    () =>
      (entities.data?.items ?? []).map(entity => ({
        id: entity._uid,
        publicId: entity._publicId,
        name: entity._name
      })),
    [entities.data]
  );
  const feed = useSpecificationItemsFeed(
    workspaceSlug,
    refs,
    config.deprecated ? { deprecated: true } : {},
    schema != null
  );

  const { sorted, sort, toggleSort } = useTableSort<SpecificationItemRow, SortKey>(
    feed.rows,
    {
      method: (a, b) =>
        specItemSortValue(a, 'method').localeCompare(specItemSortValue(b, 'method')),
      path: (a, b) => specItemSortValue(a, 'path').localeCompare(specItemSortValue(b, 'path')),
      entity: (a, b) => a.api.name.localeCompare(b.api.name)
    },
    { key: 'entity', dir: 'asc' }
  );

  if (!schema) {
    return <EmptyState title={`Schema '${config.schemaName}' not found`} compact />;
  }

  const columns: DataTableColumn<SpecificationItemRow>[] = [
    {
      id: 'method',
      header: 'Method',
      size: 110,
      minSize: 70,
      meta: { sortable: true, label: 'Method', hideable: false, copyValue: specItemCopyMethod },
      cell: ({ row }) => (
        <Chip tone="ghost" color={specItemTone(row.original.item.action)}>
          {row.original.item.action.toUpperCase()}
        </Chip>
      )
    },
    {
      id: 'path',
      header: 'Path',
      size: 320,
      minSize: 120,
      meta: { sortable: true, label: 'Path', hideable: false, copyValue: specItemCopyPath },
      cell: ({ row }) => (
        <NameCell.Content
          title={row.original.item.path ?? row.original.item.channel ?? 'Unspecified resource'}
          subtitle={row.original.item.identifier}
        />
      )
    },
    {
      id: 'entity',
      header: schema.name,
      size: 220,
      minSize: 100,
      meta: {
        sortable: true,
        label: schema.name,
        hideable: false,
        interactive: true,
        copyValue: row => row.api.name
      },
      cell: ({ row }) => (
        <button
          type="button"
          className={styles.apiName}
          onClick={() => openEntityDrawer(row.original.api.publicId)}
        >
          {row.original.api.name}
        </button>
      )
    },
    {
      id: 'deprecated',
      header: 'Deprecated',
      size: 120,
      minSize: 80,
      meta: { label: 'Deprecated', hideable: false, copyValue: specItemCopyDeprecated },
      cell: ({ row }) => row.original.item.deprecated && <Chip tone="ghost">Deprecated</Chip>
    }
  ];

  const isLoading = entities.isLoading || feed.isLoading;
  return (
    <DataTable
      scroll
      stickyHeader
      resizable
      cellSelection
      layout="fixed"
      bordered={!framed}
      columns={columns}
      data={sorted}
      getRowId={row => row.key}
      sort={sort}
      onSort={key => toggleSort(key as SortKey)}
      emptyState={
        isLoading ? 'Loading operations…' : specItemsEmptyLabel(config.deprecated === true)
      }
    />
  );
};
