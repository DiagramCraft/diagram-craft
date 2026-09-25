import { useMemo } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Chip } from '../../../components/Chip';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Banner } from '../../../components/Banner';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { useBlastRadius, type BlastRadiusPath } from '../../../hooks/useBlastRadius';
import type { BlastRadiusEntity } from '../../../lib/blastRadiusFilters';
import styles from './ApiBlastRadiusPanel.module.css';

const PROVIDES_PATH_ID = 'provides-api';
const CONSUMES_PATH_ID = 'consumes-api';
const MAX_DEPTH = 2;

type Props = {
  workspaceId: string;
  apiId: string;
  providersRelationSchemaId: string | null;
  consumersRelationSchemaId: string | null;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
};

/**
 * The Impact section's "Blast radius" panel (#3320): providers / direct consumers / second-order
 * columns, mirroring the Claude Design reference's `ICImpact` (`ic-views.jsx`) three-column
 * `ic-blast` layout. Unlike the design, this is backed by the real `Provides API`/`Consumes API`
 * typed relations via the generic traversal engine (#2979) instead of a bespoke, fabricated
 * "consumer registration" model — the design's second-order hop (consumers of a direct consumer's
 * own registrations) has no real equivalent, so "second order" here is instead every entity the
 * engine reaches at depth 2 over the same two relation types (through either a provider's or a
 * consumer's own Provides/Consumes API relations), which is the closest real-data analog.
 */
export const ApiBlastRadiusPanel = ({
  workspaceId,
  apiId,
  providersRelationSchemaId,
  consumersRelationSchemaId,
  schemas,
  lifecycleStates
}: Props) => {
  const paths: BlastRadiusPath[] = useMemo(
    () => [
      ...(providersRelationSchemaId
        ? [
            {
              id: PROVIDES_PATH_ID,
              steps: [
                {
                  kind: 'unboundTypedRelation' as const,
                  relationSchemaId: providersRelationSchemaId,
                  direction: 'both' as const
                }
              ]
            }
          ]
        : []),
      ...(consumersRelationSchemaId
        ? [
            {
              id: CONSUMES_PATH_ID,
              steps: [
                {
                  kind: 'unboundTypedRelation' as const,
                  relationSchemaId: consumersRelationSchemaId,
                  direction: 'both' as const
                }
              ]
            }
          ]
        : [])
    ],
    [providersRelationSchemaId, consumersRelationSchemaId]
  );

  const { status, entities, hopLookup } = useBlastRadius(
    workspaceId,
    { kind: 'entity', entityId: apiId },
    { maxDepth: MAX_DEPTH, ownerId: null, schemaIds: null, viaSchemaIds: null },
    paths.length > 0,
    paths
  );

  const isDepth1Via = (entity: BlastRadiusEntity, pathId: string) =>
    entity.depth === 1 && entity.paths.some(path => path.pathId === pathId && path.depth === 1);
  const providers = entities.filter(entity => isDepth1Via(entity, PROVIDES_PATH_ID));
  const consumers = entities.filter(entity => isDepth1Via(entity, CONSUMES_PATH_ID));
  const depth1Ids = new Set([...providers, ...consumers].map(entity => entity.entityId));
  const secondOrder = entities.filter(entity => !depth1Ids.has(entity.entityId));

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Blast radius</span>
      </div>
      {paths.length === 0 ? (
        <div className={styles.panelBody}>
          <EmptyState
            title="Impact cannot be computed"
            subtitle="This workspace's `api` schema has no Provides API/Consumes API typed-relation fields configured."
          />
        </div>
      ) : status === 'loading' ? (
        <div className={styles.panelBody}>
          <LoadingState text="Computing blast radius…" size="sm" />
        </div>
      ) : status === 'error' ? (
        <div className={styles.panelBody}>
          <Banner variant="error">Could not compute the blast radius.</Banner>
        </div>
      ) : (
        <div className={styles.blast}>
          <BlastRadiusColumn
            title="Providers"
            emptyLabel="No provider relation recorded."
            entities={providers}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            hopLookup={hopLookup}
          />
          <BlastRadiusColumn
            title="Direct consumers"
            emptyLabel="No consumer registered against this API."
            entities={consumers}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            hopLookup={hopLookup}
          />
          <BlastRadiusColumn
            title="Second order"
            emptyLabel="Nothing reachable two hops out."
            entities={secondOrder}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            hopLookup={hopLookup}
            showVia
          />
        </div>
      )}
    </div>
  );
};

const BlastRadiusColumn = ({
  title,
  emptyLabel,
  entities,
  schemas,
  lifecycleStates,
  hopLookup,
  showVia
}: {
  title: string;
  emptyLabel: string;
  entities: BlastRadiusEntity[];
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  hopLookup: ReturnType<typeof useBlastRadius>['hopLookup'];
  showVia?: boolean;
}) => (
  <div className={styles.column}>
    <div className={styles.columnHead}>
      {title} <span className={styles.dim}>{entities.length}</span>
    </div>
    {entities.length === 0 ? (
      <div className={styles.empty}>{emptyLabel}</div>
    ) : (
      <div className={styles.list}>
        {entities.map(entity => (
          <BlastRadiusNode
            key={entity.entityId}
            entity={entity}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            hopLookup={hopLookup}
            showVia={showVia}
          />
        ))}
      </div>
    )}
  </div>
);

const BlastRadiusNode = ({
  entity,
  schemas,
  lifecycleStates,
  hopLookup,
  showVia
}: {
  entity: BlastRadiusEntity;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  hopLookup: ReturnType<typeof useBlastRadius>['hopLookup'];
  showVia?: boolean;
}) => {
  const schemaIdx = schemas.findIndex(s => s.id === entity.schemaId);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';
  const path = entity.paths[0];
  const intermediateHops = showVia && path ? path.provenance.slice(1, -1) : [];
  const publicId = hopLookup.get(entity.entityId)?.publicId;

  return (
    <EntityNavigationLink publicId={publicId ?? entity.entityId} className={styles.node}>
      <span className={styles.nodeLead}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
        <span className={styles.nodeName}>{entity.entityName}</span>
      </span>
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
      {entity.lifecycleState && (
        <span className={styles.nodeMeta}>
          <StatusChip value={entity.lifecycleState} lifecycleStates={lifecycleStates} />
        </span>
      )}
    </EntityNavigationLink>
  );
};
