import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TbChevronDown } from 'react-icons/tb';
import { MAX_PATH_HOPS, type PathStep } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { useEntitiesByIdSetQuery } from '../../../hooks/useEntities';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useDelayedFlag } from '../../../hooks/useDelayedFlag';
import { EmptyState } from '../../../components/EmptyState';
import { EntityHoverCard } from '../../../components/EntityHoverCard';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { groupPathStepOptions, targetSchemaIdsForStep } from './pathBuilder/pathBuilderState';
import type { BrowserEntityRecord } from './entityBrowserState';
import { WalkerColumn } from './WalkerColumn';
import { useHopFanoutCounts } from './useHopFanoutCounts';
import styles from './PathWalkerView.module.css';
import {
  hopDirectionGlyph,
  hopOptionsFrom,
  pathStepKey,
  pathWalkerHops
} from './pathWalkerViewState';

type PathWalkerViewProps = {
  rows: BrowserEntityRecord[];
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  workspaceId: string;
  config: unknown;
  onEntityClick: (publicId: string) => void;
  isLoading?: boolean;
  /** Selected entity id per column, from the URL. Undefined for published embeds. */
  selection?: string[];
  /** Persists a new hop sequence + selection together. Omitted for published embeds, where both
   *  live in local state (hops seeded once from `config`). */
  onWalkChange?: (hops: PathStep[], selection: string[]) => void;
};

export const PathWalkerView = ({
  rows,
  schemas,
  relationSchemas,
  workspaceId,
  config,
  onEntityClick,
  isLoading = false,
  selection: selectionProp,
  onWalkChange
}: PathWalkerViewProps) => {
  const [localHops, setLocalHops] = useState<PathStep[]>(() => pathWalkerHops(config));
  const [localSelection, setLocalSelection] = useState<string[]>([]);
  const hops = onWalkChange ? pathWalkerHops(config) : localHops;
  const selection = onWalkChange ? (selectionProp ?? []) : localSelection;
  const commit = useCallback(
    (nextHops: PathStep[], nextSelection: string[]) => {
      if (onWalkChange) onWalkChange(nextHops, nextSelection);
      else {
        setLocalHops(nextHops);
        setLocalSelection(nextSelection);
      }
    },
    [onWalkChange]
  );

  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const showLoading = useDelayedFlag(isLoading, 300);

  const schemaById = useMemo(
    () => new Map(schemas.map((schema, index) => [schema.id, { schema, index }])),
    [schemas]
  );
  const renderBadge = (schemaId: string | undefined): ReactNode => {
    if (!schemaId) return null;
    const entry = schemaById.get(schemaId);
    if (!entry) return null;
    return (
      <TypeBadge color={resolveSchemaColor(entry.schema, entry.index)} icon={entry.schema.icon} size={15} />
    );
  };

  const rowByUid = useMemo(() => new Map(rows.map(row => [row._uid, row])), [rows]);
  const rootIds = useMemo(() => rows.map(row => row._uid), [rows]);
  const rootFanout = useHopFanoutCounts(workspaceId, rootIds, hops[0]);
  const selectedRecords = useEntitiesByIdSetQuery(workspaceId, selection).data;
  const schemaOf = (id: string) =>
    rowByUid.get(id)?._schema.id ?? selectedRecords.get(id)?._schema.id;
  // Undefined until the record resolves - the breadcrumb shows the contiguous prefix of
  // already-named steps rather than flashing a raw id.
  const nameOf = (id: string): string | undefined =>
    rowByUid.get(id)?._name ?? selectedRecords.get(id)?._name;
  const crumbNames: string[] = [];
  for (const id of selection) {
    const name = nameOf(id);
    if (name == null) break;
    crumbNames.push(name);
  }

  const selectRoot = useCallback(
    (rootId: string) => commit(hops, [rootId]),
    [commit, hops]
  );
  const selectNode = useCallback(
    (depth: number, entityId: string) => commit(hops, [...selection.slice(0, depth), entityId]),
    [commit, hops, selection]
  );
  const pickHop = (arrowIndex: number, step: PathStep | null) => {
    const nextHops = step ? [...hops.slice(0, arrowIndex), step] : hops.slice(0, arrowIndex);
    commit(nextHops, selection.slice(0, arrowIndex + 1));
  };

  // Preselect the first entity of every column that has a hop leaving it, so the intermediate
  // steps of a chain read end-to-end (mainly when a saved view's remembered hop sequence is
  // replayed). The last column - the one you're still deciding in, with no next hop chosen - is
  // left unselected. An explicit click always takes over. Column 0 handled here; hop columns
  // auto-select their own first row in WalkerColumn.
  useEffect(() => {
    if (selection.length === 0 && rows.length > 0 && hops.length > 0) selectRoot(rows[0]!._uid);
  }, [selection.length, rows, hops.length, selectRoot]);

  const columnLabel = (hop: PathStep): string => {
    const ids = targetSchemaIdsForStep(hop, schemas, relationSchemas);
    const names = ids.map(id => schemaById.get(id)?.schema.name).filter(Boolean) as string[];
    if (names.length === 1) return names[0]!;
    if (names.length > 1) return `${names[0]} +${names.length - 1}`;
    return 'Linked entities';
  };
  const rootLabel = useMemo(() => {
    const names = [...new Set(rows.map(row => schemaById.get(row._schema.id)?.schema.name).filter(Boolean))];
    return names.length === 1 ? (names[0] as string) : 'Root entities';
  }, [rows, schemaById]);

  const columns: ReactNode[] = [];
  columns.push(
    <div className={styles.column} key="col-0">
      <div className={styles.columnHead}>
        <span>{rootLabel}</span>
        <span className={styles.count}>{rows.length}</span>
      </div>
      {isLoading ? (
        showLoading ? <div className={styles.columnEmpty}>Loading…</div> : null
      ) : rows.length === 0 ? (
        <div className={styles.columnEmpty}>No entities match the current filter.</div>
      ) : (
        rows.map(row => (
          <button
            key={row._uid}
            type="button"
            className={`${styles.row} ${selection[0] === row._uid ? styles.rowActive : ''}`}
            onClick={() => selectRoot(row._uid)}
          >
            {renderBadge(row._schema.id)}
            <span className={styles.name}>
              <EntityHoverCard
                entityId={row._uid}
                extra={
                  <div className={styles.hoverOpenWrap}>
                    <button
                      type="button"
                      className={styles.hoverOpen}
                      onClick={event => {
                        event.stopPropagation();
                        onEntityClick(row._publicId);
                      }}
                    >
                      Open
                    </button>
                  </div>
                }
              >
                {row._name}
              </EntityHoverCard>
            </span>
            {rootFanout.has(row._uid) && (
              <span className={styles.rowMeta}>{rootFanout.get(row._uid)}</span>
            )}
          </button>
        ))
      )}
    </div>
  );

  for (let i = 0; i < MAX_PATH_HOPS; i += 1) {
    const fromId = selection[i];
    if (!fromId) break;
    const fromSchemaId = schemaOf(fromId);
    const options = fromSchemaId
      ? hopOptionsFrom({ schemaId: fromSchemaId, schemas, relationSchemas, getFieldGroupAccess })
      : [];
    const currentHop = hops[i];
    const currentKey = currentHop ? pathStepKey(currentHop) : '';
    const hopResolvable = !!currentHop && options.some(o => pathStepKey(o.step) === currentKey);

    columns.push(
      <div className={styles.link} key={`arrow-${i}`}>
        <div className={styles.selectWrap}>
          <select
            className={styles.linkSelect}
            value={currentKey}
            aria-label={`Relation to follow from column ${i + 1}`}
            onChange={event => {
              const option = options.find(o => pathStepKey(o.step) === event.target.value);
              pickHop(i, option ? option.step : null);
            }}
          >
            <option value="">Choose relation…</option>
            {currentHop && !hopResolvable && (
              <option value={currentKey} disabled>
                Unavailable relation
              </option>
            )}
            {groupPathStepOptions(options).map(({ group, options: opts }) => (
              <optgroup key={group} label={group}>
                {opts.map(option => (
                  <option key={pathStepKey(option.step)} value={pathStepKey(option.step)}>
                    {hopDirectionGlyph(option.step)} {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <TbChevronDown size={11} />
        </div>
        <span className={styles.linkArrow} />
      </div>
    );

    if (!currentHop) break;
    columns.push(
      <WalkerColumn
        key={`col-${i + 1}`}
        workspaceId={workspaceId}
        depth={i + 1}
        fromEntityId={fromId}
        hop={currentHop}
        columnLabel={columnLabel(currentHop)}
        selectedId={selection[i + 1]}
        autoSelectFirst={!!hops[i + 1]}
        nextHop={hops[i + 1]}
        onSelect={selectNode}
        onOpen={onEntityClick}
        renderBadge={renderBadge}
      />
    );
    if (!selection[i + 1]) break;
  }

  return (
    <div className={styles.wrap}>
      {rows.length === 0 && !isLoading ? (
        <EmptyState
          title="No entities to walk"
          subtitle="Adjust the browser filter to list the entities this walk should start from."
        />
      ) : (
        <>
          {crumbNames.length > 0 && (
            <div className={styles.path}>
              {crumbNames.map((name, index) => (
                <Fragment key={`${index}-${name}`}>
                  {index > 0 && <span className={styles.pathArrow}> → </span>}
                  <span className={styles.pathNode}>{name}</span>
                </Fragment>
              ))}
            </div>
          )}
          <div className={styles.walker}>{columns}</div>
        </>
      )}
    </div>
  );
};
