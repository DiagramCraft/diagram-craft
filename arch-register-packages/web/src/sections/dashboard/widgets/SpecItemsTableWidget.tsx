import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import {
  useSpecificationItemsFeed,
  type SpecificationItemRow
} from '../../../hooks/useSpecificationItemsFeed';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { entitiesQuery } from '../../../queries/entities';
import { stripEmptyGroups } from '../../entities/components/entityBrowserState';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { resolveEntityQuery } from '../../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedFieldResolution';
import { specItemsEmptyLabel, specItemTone, specItemSortValue } from './specItemsTableLogic';

export type SpecItemsTableWidgetConfig = {
  /** Display name of the entity schema whose specification artifacts are listed. */
  schemaName: string;
  /** Optional structured filter on those entities (field NAMEs are resolved at render time); may
   *  reference sidebar `$variables` — an empty multi-select means no constraint. */
  entityQuery?: EntityQuery;
  /** Only list deprecated items. */
  deprecated?: boolean;
  /** Maximum number of entities whose specifications are read. Default 200. */
  entityLimit?: number;
  label?: string;
};

const DEFAULT_ENTITY_LIMIT = 200;

type SortKey = 'method' | 'path' | 'entity';

/**
 * A flat, sortable table of operations/messages across the specifications of every entity of a
 * schema in scope. Not tied to any application: any schema with an `api-specification` artifact can
 * be listed, optionally narrowed by a structured filter and/or to deprecated items.
 */
export const SpecItemsTableWidget = ({ config }: { config: SpecItemsTableWidgetConfig }) => {
  const { workspaceSlug, schemas, relationSchemas } = useWorkspaceContext();
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

  const isLoading = entities.isLoading || feed.isLoading;
  return (
    <Table.Root scroll stickyHeader bordered={false}>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="method" sort={sort} onSort={toggleSort}>
            Method
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="path" sort={sort} onSort={toggleSort}>
            Path
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="entity" sort={sort} onSort={toggleSort}>
            {schema.name}
          </Table.SortableHeaderCell>
          <Table.HeaderCell>Deprecated</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={4}>
            {isLoading ? 'Loading operations…' : specItemsEmptyLabel(config.deprecated === true)}
          </Table.EmptyRow>
        ) : (
          sorted.map(row => (
            <Table.Row key={row.key} onClick={() => openEntityDrawer(row.api.publicId)}>
              <Table.Cell>
                <Chip tone="ghost" color={specItemTone(row.item.action)}>
                  {row.item.action.toUpperCase()}
                </Chip>
              </Table.Cell>
              <Table.NameCell
                title={row.item.path ?? row.item.channel ?? 'Unspecified resource'}
                subtitle={row.item.identifier}
              />
              <Table.Cell className="dim">{row.api.name}</Table.Cell>
              <Table.Cell>{row.item.deprecated && <Chip tone="ghost">Deprecated</Chip>}</Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
