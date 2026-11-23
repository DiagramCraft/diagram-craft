import { FieldDescriptionIcon } from '../../../components/FieldDescriptionIcon';
import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { DropdownMenu } from '../../../components/DropdownMenu';
import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { Table } from '../../../components/table/Table';
import { NameCell } from '../../../components/table/NameCell';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  browserEntityMenuItems,
  entityName,
  type EntityBrowserBaseViewProps
} from './entityBrowserViewShared';
import { useEntityCommonActions } from './useEntityCommonActions';
import { nextSort, parseSort } from './entityBrowserSort';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import {
  filterDisplayFieldIdsForContext,
  findEntityDisplayField,
  formatEntityDisplayValue,
  getColumnRenderer,
  getDisplayFieldIds,
  getEntityDisplayRawValue,
  isNumericDisplayField,
  type EntityDisplayField
} from './entityDisplayFields';
import { renderColumnValue } from './columnRenderers';
import { isEntityInProject } from './entityBrowserState';
import styles from './TableView.module.css';

type DateField = Extract<EntitySchema['fields'][number], { type: 'date' }>;

export type TableViewProps = EntityBrowserBaseViewProps & {
  activeDateField?: DateField | null;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (uid: string) => void;
  config: unknown;
  displayFields: EntityDisplayField[];
  /** Omit the Type column, e.g. when the browser is scoped to a single schema. */
  hideTypeColumn?: boolean;
  /** Clicking a row navigates to the entity page instead of calling `onEntityClick`. */
  rowOpensEntityPage?: boolean;
  /** Current `sort` string and its setter; when both are given, column headers are sortable. */
  sort?: string;
  onSortChange?: (sort: string) => void;
};

type Entity = TableViewProps['rows'][number];

export const TableView = ({
  rows,
  schemaMap,
  activeDateField,
  onEntityClick,
  rowOpensEntityPage,
  onDelete,
  onClone,
  onManageCollections,
  onMerge,
  projectContext,
  selectedIds,
  onSelectAll,
  onSelectRow,
  readOnly,
  config,
  displayFields,
  hideTypeColumn,
  sort,
  onSortChange
}: TableViewProps) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const commonActions = useEntityCommonActions();
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  const fieldIds = filterDisplayFieldIdsForContext(
    getDisplayFieldIds('table', config),
    projectContext != null
  );

  const buildColumns = (): DataTableColumn<Entity>[] => {
    const dynamic = fieldIds
      .filter(id => id !== '_description')
      .map(
        id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
      );

    const result: DataTableColumn<Entity>[] = [
      {
        id: '_name',
        header: 'Name',
        meta: { sortable: true, label: 'Name', width: 200, sticky: true },
        cell: ({ row }) => {
          const entity = row.original;
          const schemaEntry = schemaMap.get(entity._schema.id);
          return (
            <NameCell.Content
              icon={
                schemaEntry && (
                  <TypeBadge
                    color={resolveSchemaColor(schemaEntry.schema, schemaEntry.index)}
                    name={schemaEntry.schema.name}
                    icon={schemaEntry.schema.icon}
                    size={18}
                  />
                )
              }
              title={
                <EntityNavigationLink
                  publicId={entity._publicId}
                  behavior={rowOpensEntityPage ? 'page' : 'drawer'}
                  className={styles.nameLink}
                >
                  {entityName(entity)}
                </EntityNavigationLink>
              }
              titleMuted={
                projectContext != null && !isEntityInProject(entity, projectContext.project.id)
              }
              subtitle={
                fieldIds.includes('_description') && entity._description
                  ? entity._description
                  : undefined
              }
            />
          );
        }
      }
    ];

    if (!hideTypeColumn) {
      result.push({
        id: '_type',
        header: 'Type',
        meta: { label: 'Type' },
        cell: ({ row }) => {
          const schemaEntry = schemaMap.get(row.original._schema.id);
          return schemaEntry && <Chip tone="ghost">{schemaEntry.schema.name}</Chip>;
        }
      });
    }

    for (const column of dynamic) {
      result.push({
        id: column.id,
        header: () => (
          <>
            {column.label}
            <FieldDescriptionIcon description={column.schemaField?.description} inline />
          </>
        ),
        meta: { sortable: true, label: column.label, numeric: isNumericDisplayField(column) },
        cell: ({ row }) => {
          const entity = row.original;
          const field =
            findEntityDisplayField(column.id, entity, schemaMap, displayFields) ?? column;
          return renderColumnValue(
            {
              value: getEntityDisplayRawValue(entity, field),
              text: formatEntityDisplayValue(entity, field, dateTimeFormatPreference),
              field
            },
            getColumnRenderer(config, field.id)
          );
        }
      });
    }

    if (activeDateField && !fieldIds.includes(activeDateField.id)) {
      result.push({
        id: activeDateField.id,
        header: activeDateField.name,
        meta: { sortable: true, label: activeDateField.name },
        cell: ({ row }) => {
          const value = (row.original as unknown as Record<string, unknown>)[activeDateField.id];
          return (
            <span>
              {formatDate(
                Array.isArray(value)
                  ? (value[0] as string | undefined)
                  : (value as string | undefined),
                '—',
                dateTimeFormatPreference
              )}
            </span>
          );
        }
      });
    }

    if (!readOnly) {
      result.push({
        id: '_actions',
        header: '',
        meta: { interactive: true, align: 'right', width: 28, selectable: false, hideable: false },
        cell: ({ row }) => {
          const menuItems = browserEntityMenuItems(
            row.original,
            { onClone, onDelete, onManageCollections, onMerge, projectContext },
            commonActions
          );
          return menuItems.length > 0 ? (
            <DropdownMenu trigger={<Table.DotsButton />} items={menuItems} />
          ) : null;
        }
      });
    }

    return result;
  };
  const columns = buildColumns();

  const selectedRowIds = useMemo(
    () => Object.fromEntries([...(selectedIds ?? [])].map(id => [id, true as const])),
    [selectedIds]
  );

  return (
    <DataTable
      scroll
      columns={columns}
      data={rows}
      getRowId={entity => entity._uid}
      sort={sort !== undefined ? parseSort(sort) : null}
      onSort={
        onSortChange && sort !== undefined ? key => onSortChange(nextSort(sort, key)) : undefined
      }
      selectable={!readOnly}
      selectedRowIds={selectedRowIds}
      // The table reports the full next selection; one changed id is a row toggle, several is select-all
      onSelectedRowIdsChange={next => {
        const changed = new Set([...Object.keys(next), ...Object.keys(selectedRowIds)]).values();
        const diff = [...changed].filter(id => !!next[id] !== !!selectedRowIds[id]);
        if (diff.length === 1 && rows.length !== 1) onSelectRow?.(diff[0]!);
        else if (diff.length > 0) onSelectAll?.();
      }}
      onRowClick={entity =>
        rowOpensEntityPage
          ? void navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          : onEntityClick(entity._publicId)
      }
    />
  );
};
