import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { relationIds } from '../../../lib/entityEditState';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { relationFieldValue } from '../dataFlowRelationDisplay';
import styles from './ApiSpecDrawer.module.css';

/**
 * The Integrations detail panel: one `Data Flow` relation's endpoints, protocol, carried data,
 * classification, boundary-crossing flag, and the shared `data-flow-governance` fields, plus a link
 * into the shared `ApiSpecDrawer` (#3316) when either endpoint provides/consumes a registered API.
 * A slide-over drawer, like every other detail panel in this app (`ApiSpecDrawer.tsx`) and its
 * siblings elsewhere (`DatasetDrawer.tsx`, `RiskDrawer.tsx`) — the Claude Design reference's
 * `ICIntegrations` (`ic-views.jsx`) renders this inline instead, but a drawer keeps the pattern
 * consistent with the rest of the app and reads better for a field-heavy relation like this one.
 */
export const IntegrationDrawer = ({
  workspaceSlug,
  relation,
  relationSchema,
  registeredApi,
  onClose,
  onOpenApi
}: {
  workspaceSlug: string;
  relation: RelationRecord;
  relationSchema: RelationSchema | undefined;
  registeredApi: { id: string; name: string } | null;
  onClose: () => void;
  onOpenApi: (apiId: string) => void;
}) => {
  const navigate = useNavigate();
  const carriedIds = relationIds(relation.data_entities);
  const endpointIds = [relation._in.id, relation._out.id];
  const entities = useEntitiesByIds(workspaceSlug, [...endpointIds, ...carriedIds]);

  const openEntity = (id: string) => {
    const ref = entities.get(id);
    if (!ref) return;
    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(ref.publicId)));
  };

  const crosses = relation.cross_boundary === 'cross-boundary';

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">Data Flow</span>}
      title={`${relation._in.name} → ${relation._out.name}`}
      badges={
        <>
          <Chip tone="ghost">
            {relationFieldValue(relationSchema, relation, 'data_classification')}
          </Chip>
          {crosses && <Chip tone="ghost">crosses boundary</Chip>}
        </>
      }
      footer={
        registeredApi ? (
          <Button variant="primary" onClick={() => onOpenApi(registeredApi.id)}>
            Open specification — {registeredApi.name}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.sectionLabel}>Endpoints</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Source</span>
        <button
          type="button"
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
          onClick={() => openEntity(relation._in.id)}
        >
          {relation._in.name}
        </button>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Destination</span>
        <button
          type="button"
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
          onClick={() => openEntity(relation._out.id)}
        >
          {relation._out.name}
        </button>
      </div>

      <div className={styles.sectionLabel}>Flow</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Direction</span>
        <span>{relationFieldValue(relationSchema, relation, 'direction')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Protocol</span>
        <span>{relationFieldValue(relationSchema, relation, 'protocol')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Classification</span>
        <span>{relationFieldValue(relationSchema, relation, 'data_classification')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Boundary</span>
        <span>{crosses ? 'Crosses' : 'Internal'}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Owner</span>
        <span>{relation._owner?.name ?? '—'}</span>
      </div>

      <div className={styles.sectionLabel}>Carried data</div>
      {carriedIds.length === 0 ? (
        <span className="dim">No Data Entities linked.</span>
      ) : (
        <div className={styles.attributeRow}>
          {carriedIds.map(id => {
            const ref = entities.get(id);
            return (
              <Chip key={id} tone="ghost">
                {ref?.name ?? id}
              </Chip>
            );
          })}
        </div>
      )}

      <div className={styles.sectionLabel}>Governance</div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Regulatory tags</span>
        <span>{relationFieldValue(relationSchema, relation, 'regulatory_tags')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Processing purposes</span>
        <span>{relationFieldValue(relationSchema, relation, 'processing_purposes')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Source residency</span>
        <span>{relationFieldValue(relationSchema, relation, 'source_residency_region')}</span>
      </div>
      <div className={styles.attributeRow}>
        <span className={styles.attributeLabel}>Destination residency</span>
        <span>{relationFieldValue(relationSchema, relation, 'destination_residency_region')}</span>
      </div>

      {!registeredApi && (
        <>
          <div className={styles.sectionLabel}>Registered API</div>
          <span className="dim">No specification registered.</span>
        </>
      )}
    </Drawer>
  );
};
