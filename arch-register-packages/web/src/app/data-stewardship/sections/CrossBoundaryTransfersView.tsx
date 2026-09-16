import { useMemo, type ReactNode } from 'react';
import { Chip } from '../../../components/Chip';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { relationIds } from '../../../lib/entityEditState';
import type { DataFlowConfig } from '../useDataFlowConfig';
import { evaluateDataFlowCoverage, relationFieldValue } from '../dataFlowClassification';
import { DataFlowNotConfiguredNotice } from './DataFlowNotConfiguredNotice';
import styles from './DataStewardshipStewardshipScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

/**
 * The "cross-boundary transfers" view: every Data Flow relation whose derived `cross_boundary`
 * field is `'cross-boundary'`, paired with the exception that authorizes it — except that pairing
 * doesn't exist yet (#3301). Mirrors the Claude Design reference's `DSClassification`'s
 * `view === "transfers"` panel (`ds-views.jsx`): a card list (`.item`, not a table row) — each
 * transfer's route, classification and personal-data chips, a descriptive note, and a meta row of
 * carried-dataset links plus the flow's owner — rather than the flat table this view used before.
 * The design pairs a transfer with real exception chips when one exists and falls back to a
 * "no transfer safeguard recorded" tag otherwise; since no exception model exists yet, every
 * personal-data-carrying transfer here always takes that fallback branch — see
 * `../dataFlowClassification.ts`'s `evaluateDataFlowCoverage`, the single place that logic lives.
 */
export const CrossBoundaryTransfersView = ({
  workspaceSlug,
  dataFlowConfig,
  openDataset,
  viewSwitcher
}: {
  workspaceSlug: string;
  dataFlowConfig: DataFlowConfig | null;
  openDataset: (id: string) => void;
  viewSwitcher: ReactNode;
}) => {
  const relationSchemas = useRelationSchemas(workspaceSlug, dataFlowConfig != null);
  const relationSchema = relationSchemas.data?.find(
    candidate => candidate.id === dataFlowConfig?.relationSchemaId
  );

  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig != null }
  );

  const crossBoundary = useMemo(
    () => relations.data.filter(relation => relation.cross_boundary === 'cross-boundary'),
    [relations.data]
  );

  const carriedEntityIds = useMemo(
    () => crossBoundary.flatMap(relation => relationIds(relation.data_entities)),
    [crossBoundary]
  );
  const carriedEntities = useEntitiesByIds(workspaceSlug, carriedEntityIds);

  const coverageByUid = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateDataFlowCoverage>>();
    for (const relation of crossBoundary) {
      map.set(
        relation._uid,
        evaluateDataFlowCoverage({
          crossBoundary: relation.cross_boundary,
          classification: relation.data_classification
        })
      );
    }
    return map;
  }, [crossBoundary]);

  if (!dataFlowConfig) {
    return (
      <>
        {viewSwitcher}
        <DataFlowNotConfiguredNotice title="Cross-boundary transfers" />
      </>
    );
  }

  const carryingPersonalData = crossBoundary.filter(
    relation => coverageByUid.get(relation._uid)?.carriesPersonalData
  ).length;
  const unsafeguarded = crossBoundary.filter(
    relation => coverageByUid.get(relation._uid)?.unsafeguardedPersonalDataTransfer
  ).length;

  return (
    <>
      <div className={styles.tilesThree}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Cross-boundary transfers</div>
          <div className={styles.tileValue}>{crossBoundary.length}</div>
          <div className={styles.tileSub}>source and destination regions differ</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Carrying personal data</div>
          <div
            className={styles.tileValue}
            style={carryingPersonalData ? { color: WARN } : undefined}
          >
            {carryingPersonalData}
          </div>
          <div className={styles.tileSub}>classification is sensitive or higher</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Unsafeguarded personal-data transfers</div>
          <div className={styles.tileValue} style={unsafeguarded ? { color: DANGER } : undefined}>
            {unsafeguarded}
          </div>
          <div className={styles.tileSub}>no exception recorded</div>
        </div>
      </div>

      {viewSwitcher}

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Cross-boundary transfers</span>
          <span className="dim mono">{crossBoundary.length}</span>
        </div>
        {crossBoundary.length === 0 ? (
          <div className={styles.stack}>
            <div className={styles.item} style={{ fontSize: 11.5 }}>
              <span className="dim">
                {relations.isLoading ? 'Loading flows…' : 'No cross-boundary flow is recorded.'}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            {crossBoundary.map(relation => {
              const coverage = coverageByUid.get(relation._uid);
              const ids = relationIds(relation.data_entities);
              const sourceRegion = relationFieldValue(
                relationSchema,
                relation,
                'source_residency_region'
              );
              const destRegion = relationFieldValue(
                relationSchema,
                relation,
                'destination_residency_region'
              );
              const protocol = relationFieldValue(relationSchema, relation, 'protocol');
              return (
                <div key={relation._uid} className={styles.item}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5 }}>
                      {relation._in.name} → {relation._out.name}
                    </span>
                    <Chip tone="ghost">
                      {relationFieldValue(relationSchema, relation, 'data_classification')}
                    </Chip>
                    {coverage?.carriesPersonalData && <Chip tone="ghost">personal data</Chip>}
                    {coverage?.unsafeguardedPersonalDataTransfer && (
                      <span className={styles.gapTag}>no transfer safeguard recorded</span>
                    )}
                  </div>
                  <div className={styles.itemNote}>
                    {sourceRegion} → {destRegion}
                    {protocol !== '—' ? ` via ${protocol}` : ''}.
                  </div>
                  <div className={styles.itemMeta}>
                    {ids.map(id => {
                      const ref = carriedEntities.get(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={styles.link}
                          onClick={() => openDataset(ref?.publicId ?? id)}
                        >
                          {ref?.name ?? id}
                        </button>
                      );
                    })}
                    <span className="mono">owner {relation._owner?.name ?? 'unassigned'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
