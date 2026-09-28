import { useMemo, useState } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import type { EntityTraversalSubject } from '@arch-register/api-types/entityTraversalContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Chip } from '../../../components/Chip';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { useTeams } from '../../../hooks/useWorkspaceConfig';
import {
  useBlastRadius,
  DEFAULT_BLAST_RADIUS_DEPTH,
  type BlastRadiusPath
} from '../../../hooks/useBlastRadius';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import styles from './BlastRadiusPanel.module.css';

type HopLookup = ReturnType<typeof useBlastRadius>['hopLookup'];

export type BlastRadiusGroup = {
  id: string;
  label: string;
  emptyText: string;
  select: (entities: BlastRadiusEntity[]) => BlastRadiusEntity[];
  showVia?: boolean;
};

type Props = {
  workspaceId: string;
  subject: EntityTraversalSubject;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  // Scopes the traversal to specific relation types instead of the default wildcard walk — see
  // useBlastRadius's `paths` param. An empty array means "no relations configured": nothing is
  // fetched and `noPathsState` is shown.
  paths?: readonly BlastRadiusPath[];
  // Renders entities as columns (one per group) in a titled card instead of a flat list.
  groups?: readonly BlastRadiusGroup[];
  // Shows the depth/owner toolbar. When false, `maxDepth` is fixed.
  showFilters?: boolean;
  maxDepth?: number;
  // Wraps the panel in a bordered card with this header.
  title?: string;
  noPathsState?: { title: string; subtitle: string };
};

const DEPTH_OPTIONS = [
  { value: '1', label: 'Direct (depth 1)' },
  { value: '2', label: 'Extended (depth 2)' },
  { value: '3', label: 'Extended (depth 3)' }
];

export const BlastRadiusPanel = ({
  workspaceId,
  subject,
  schemas,
  lifecycleStates,
  paths,
  groups,
  showFilters = true,
  maxDepth,
  title,
  noPathsState
}: Props) => {
  const [depth, setDepth] = useState(maxDepth ?? DEFAULT_BLAST_RADIUS_DEPTH);
  const [ownerFilter, setOwnerFilter] = useState('all');

  const { data: teams } = useTeams(workspaceId, showFilters);
  const ownerOptions = useMemo(
    () => [
      { value: 'all', label: 'All owners' },
      ...(teams ?? []).map(team => ({ value: team.id, label: team.name }))
    ],
    [teams]
  );

  const pathsMissing = paths !== undefined && paths.length === 0;

  // Entity-schema and relationship-type filtering are still supported end-to-end (useBlastRadius,
  // the aggregate endpoint, and the traversal engine) - just not exposed as controls here, to keep
  // this view simple. Pass schemaIds/viaSchemaIds again if that's wanted back.
  const { status, entities, totalCount, hopLookup } = useBlastRadius(
    workspaceId,
    subject,
    {
      maxDepth: showFilters ? depth : (maxDepth ?? DEFAULT_BLAST_RADIUS_DEPTH),
      ownerId: showFilters && ownerFilter !== 'all' ? ownerFilter : null,
      schemaIds: null,
      viaSchemaIds: null
    },
    !pathsMissing,
    paths
  );

  const body = pathsMissing ? (
    <EmptyState
      title={noPathsState?.title ?? 'No impact found'}
      subtitle={noPathsState?.subtitle ?? 'No relations are configured for this view.'}
    />
  ) : status === 'loading' ? (
    <LoadingState text="Computing blast radius…" size="sm" />
  ) : status === 'error' ? (
    <Banner variant="error">
      {showFilters
        ? 'Could not compute the blast radius. Try narrowing the depth or filters.'
        : 'Could not compute the blast radius.'}
    </Banner>
  ) : groups ? (
    <div className={styles.blast}>
      {groups.map(group => {
        const groupEntities = group.select(entities);
        return (
          <div key={group.id} className={styles.column}>
            <div className={styles.columnHead}>
              {group.label} <span className={styles.dim}>{groupEntities.length}</span>
            </div>
            {groupEntities.length === 0 ? (
              <div className={styles.empty}>{group.emptyText}</div>
            ) : (
              <div className={styles.cardList}>
                {groupEntities.map(entity => (
                  <BlastRadiusItem
                    key={entity.entityId}
                    variant="card"
                    entity={entity}
                    schemas={schemas}
                    lifecycleStates={lifecycleStates}
                    hopLookup={hopLookup}
                    showVia={group.showVia}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : entities.length === 0 ? (
    <EmptyState
      title={totalCount === 0 ? 'No impact found' : 'No results match the current filters'}
      subtitle={
        totalCount === 0
          ? 'No entities are reachable within the selected depth.'
          : 'Try widening the owner filter.'
      }
    />
  ) : (
    <div className={styles.list}>
      {entities.map(entity => (
        <BlastRadiusItem
          key={entity.entityId}
          variant="row"
          entity={entity}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          hopLookup={hopLookup}
          showVia
        />
      ))}
    </div>
  );

  if (title !== undefined) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{title}</span>
        </div>
        {showFilters && (
          <Toolbar {...{ depth, setDepth, ownerFilter, setOwnerFilter, ownerOptions }} />
        )}
        {groups && !pathsMissing && status !== 'loading' && status !== 'error' ? (
          body
        ) : (
          <div className={styles.cardBody}>{body}</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {showFilters && (
        <Toolbar {...{ depth, setDepth, ownerFilter, setOwnerFilter, ownerOptions }} />
      )}
      {body}
    </div>
  );
};

const Toolbar = ({
  depth,
  setDepth,
  ownerFilter,
  setOwnerFilter,
  ownerOptions
}: {
  depth: number;
  setDepth: (depth: number) => void;
  ownerFilter: string;
  setOwnerFilter: (owner: string) => void;
  ownerOptions: { value: string; label: string }[];
}) => (
  <div className={styles.toolbar}>
    <FilterDropdown
      label="Depth"
      value={String(depth)}
      onChange={v => setDepth(Number(v))}
      options={DEPTH_OPTIONS}
    />
    <FilterDropdown
      label="Owner"
      value={ownerFilter}
      onChange={setOwnerFilter}
      options={ownerOptions}
    />
  </div>
);

const BlastRadiusItem = ({
  variant,
  entity,
  schemas,
  lifecycleStates,
  hopLookup,
  showVia
}: {
  variant: 'row' | 'card';
  entity: BlastRadiusEntity;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  hopLookup: HopLookup;
  showVia?: boolean;
}) => {
  const schemaIdx = schemas.findIndex(s => s.id === entity.schemaId);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';
  const path = entity.paths[0];
  const intermediateHops = showVia && path ? path.provenance.slice(1, -1) : [];
  const publicId = hopLookup.get(entity.entityId)?.publicId;

  const viaChain = intermediateHops.length > 0 && (
    <span className={styles.viaChain}>
      {intermediateHops.map((hop, index) => {
        const hopSchemaIdx = schemas.findIndex(s => s.id === hop.schemaId);
        const hopSchema = hopSchemaIdx >= 0 ? schemas[hopSchemaIdx] : null;
        return (
          <span key={`${hop.id}-${index}`} className={styles.viaHop}>
            <TbChevronRight size={10} className={styles.dim} />
            <Chip tone="ghost">{hopLookup.get(hop.id)?.name ?? hopSchema?.name ?? 'Unknown'}</Chip>
          </span>
        );
      })}
    </span>
  );

  const lifecycle = entity.lifecycleState && (
    <StatusChip value={entity.lifecycleState} lifecycleStates={lifecycleStates} />
  );

  if (variant === 'card') {
    return (
      <EntityNavigationLink publicId={publicId ?? entity.entityId} className={styles.node}>
        <span className={styles.nodeLead}>
          <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
          <span className={styles.name}>{entity.entityName}</span>
        </span>
        {viaChain}
        {lifecycle && <span className={styles.nodeMeta}>{lifecycle}</span>}
      </EntityNavigationLink>
    );
  }

  return (
    <EntityNavigationLink publicId={publicId ?? entity.entityId} className={styles.row}>
      <span className={styles.rowLead}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
        <span className={styles.name}>{entity.entityName}</span>
        {viaChain}
      </span>
      <span className={styles.rowMeta}>
        <span className={styles.dim}>depth {entity.depth}</span>
        {lifecycle}
      </span>
    </EntityNavigationLink>
  );
};
