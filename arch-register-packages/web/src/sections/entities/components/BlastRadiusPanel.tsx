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
import styles from './BlastRadiusPanel.module.css';

type BlastRadiusEntity = ReturnType<typeof useBlastRadius>['entities'][number];
type HopLookup = ReturnType<typeof useBlastRadius>['hopLookup'];

type Props = {
  workspaceId: string;
  subject: EntityTraversalSubject;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  // Scopes the traversal to specific relation types instead of the default wildcard walk — see
  // useBlastRadius's `paths` param.
  paths?: readonly BlastRadiusPath[];
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
  paths
}: Props) => {
  const [depth, setDepth] = useState(DEFAULT_BLAST_RADIUS_DEPTH);
  const [ownerFilter, setOwnerFilter] = useState('all');

  const { data: teams } = useTeams(workspaceId);
  const ownerOptions = useMemo(
    () => [
      { value: 'all', label: 'All owners' },
      ...(teams ?? []).map(team => ({ value: team.id, label: team.name }))
    ],
    [teams]
  );

  // Entity-schema and relationship-type filtering are still supported end-to-end (useBlastRadius,
  // the aggregate endpoint, and the traversal engine) - just not exposed as controls here, to keep
  // this view simple. Pass schemaIds/viaSchemaIds again if that's wanted back.
  const { status, entities, totalCount, hopLookup } = useBlastRadius(
    workspaceId,
    subject,
    {
      maxDepth: depth,
      ownerId: ownerFilter === 'all' ? null : ownerFilter,
      schemaIds: null,
      viaSchemaIds: null
    },
    true,
    paths
  );

  return (
    <div className={styles.panel}>
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

      {status === 'loading' ? (
        <LoadingState text="Computing blast radius…" size="sm" />
      ) : status === 'error' ? (
        <Banner variant="error">
          Could not compute the blast radius. Try narrowing the depth or filters.
        </Banner>
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
            <BlastRadiusRow
              key={entity.entityId}
              entity={entity}
              schemas={schemas}
              lifecycleStates={lifecycleStates}
              hopLookup={hopLookup}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BlastRadiusRow = ({
  entity,
  schemas,
  lifecycleStates,
  hopLookup
}: {
  entity: BlastRadiusEntity;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  hopLookup: HopLookup;
}) => {
  const schemaIdx = schemas.findIndex(s => s.id === entity.schemaId);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';
  const path = entity.paths[0];
  const intermediateHops = path ? path.provenance.slice(1, -1) : [];
  const publicId = hopLookup.get(entity.entityId)?.publicId;

  return (
    <EntityNavigationLink publicId={publicId ?? entity.entityId} className={styles.row}>
      <span className={styles.rowLead}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
        <span className={styles.rowName}>{entity.entityName}</span>
        {intermediateHops.length > 0 && (
          <span className={styles.viaChain}>
            {intermediateHops.map((hop, index) => {
              const hopSchemaIdx = schemas.findIndex(s => s.id === hop.schemaId);
              const hopSchema = hopSchemaIdx >= 0 ? schemas[hopSchemaIdx] : null;
              return (
                <span key={`${hop.id}-${index}`} className={styles.viaHop}>
                  <TbChevronRight size={10} className={styles.dim} />
                  <Chip tone="ghost">
                    {hopLookup.get(hop.id)?.name ?? hopSchema?.name ?? 'Unknown'}
                  </Chip>
                </span>
              );
            })}
          </span>
        )}
      </span>
      <span className={styles.rowMeta}>
        <span className={styles.dim}>depth {entity.depth}</span>
        {entity.lifecycleState && (
          <StatusChip value={entity.lifecycleState} lifecycleStates={lifecycleStates} />
        )}
      </span>
    </EntityNavigationLink>
  );
};
