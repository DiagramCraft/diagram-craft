import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useSchemas } from '../../../hooks/useSchemas';
import { useEntityTypedRelations } from '../../../hooks/useRelations';
import { entityDetailQuery } from '../../../queries/entities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { fieldLabel, riskFieldValue } from '../riskFieldDisplay';
import type { RiskComplianceConfig } from '../riskComplianceQueries';
import styles from './ControlDrawer.module.css';

const ATTRIBUTE_FIELDS = [
  'control_type',
  'design_effectiveness',
  'operating_effectiveness',
  'last_verified'
] as const;

const CONTROL_MITIGATED_RISKS_FIELD = 'mitigated_risks';
const CONTROL_PROTECTS_FIELD = 'protected_entities';

/**
 * Slide-over showing one Control's attributes, the Risks it mitigates (with the `coverage`/
 * `effectiveness` it provides each one), and the entities it protects — mirrors
 * `../../vendor-management/sections/VendorDrawer.tsx` and `RiskDrawer.tsx`. Deep-linkable from
 * the Controls list (`risk-compliance/controls/$controlId`).
 */
export const ControlDrawer = ({
  workspaceSlug,
  controlId,
  riskConfig,
  onClose
}: {
  workspaceSlug: string;
  controlId: string;
  riskConfig: RiskComplianceConfig;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const control = useQuery(entityDetailQuery(workspaceSlug, controlId));
  const uid = control.data?._uid ?? null;
  const schemas = useSchemas(workspaceSlug);
  const controlSchema = schemas.data?.find(schema => schema.id === riskConfig.controlSchemaId);

  // Fixed relations on Control's own typedRelation fields, not capability bindings — read their
  // real, per-workspace relation schema ids off those fields, mirroring `RiskDrawer.tsx`.
  const mitigatedRisksField = controlSchema?.fields.find(
    field => field.id === CONTROL_MITIGATED_RISKS_FIELD
  );
  const riskControlRelationSchemaId =
    mitigatedRisksField?.type === 'typedRelation' ? mitigatedRisksField.relationSchemaId : null;
  const protectsField = controlSchema?.fields.find(field => field.id === CONTROL_PROTECTS_FIELD);
  const controlAffectsRelationSchemaId =
    protectsField?.type === 'typedRelation' ? protectsField.relationSchemaId : null;

  const relations = useEntityTypedRelations(workspaceSlug, uid ?? '');
  const all = [...(relations.data?.outgoing ?? []), ...(relations.data?.incoming ?? [])];
  // Control is the `_out` side of `risk-control` (`outSymSchemaIds: ['control']`) and the `_in`
  // side of `control-affects` (`inSymSchemaIds: ['control']`) — a relation's role is read off
  // `_in`/`_out` directly rather than the API's `outgoing`/`incoming` bucket names, which are
  // keyed by endpoint role (`_in` vs `_out`), not by this field's own direction.
  const mitigatedRisks = all.filter(
    relation => relation._schema.id === riskControlRelationSchemaId && relation._out.id === uid
  );
  const protectedEntities = all.filter(
    relation =>
      relation._schema.id === controlAffectsRelationSchemaId && relation._in.id === uid
  );

  if (control.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading control…</div>
      </Drawer>
    );
  }
  if (control.isError || !control.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This control is unavailable.</div>
      </Drawer>
    );
  }

  const entity = control.data;

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        typeof entity.control_type === 'string' ? (
          <Chip tone="ghost">{entity.control_type}</Chip>
        ) : undefined
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Attributes</div>
      {ATTRIBUTE_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(controlSchema, fieldId)}</span>
          <span>{riskFieldValue(controlSchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>Risks mitigated</div>
      {relations.isLoading ? (
        <span className="dim">Loading…</span>
      ) : mitigatedRisks.length > 0 ? (
        mitigatedRisks.map(relation => (
          <div className={styles.attributeRow} key={relation._uid}>
            <span className={styles.attributeLabel}>{relation._in.name}</span>
            <span>
              {typeof relation.coverage === 'number' ? `${relation.coverage}%` : '—'} ·{' '}
              {typeof relation.effectiveness === 'string' ? relation.effectiveness : '—'}
            </span>
          </div>
        ))
      ) : (
        <span className="dim">No risks mitigated.</span>
      )}

      <div className={styles.sectionLabel}>Protected entities</div>
      {relations.isLoading ? (
        <span className="dim">Loading…</span>
      ) : protectedEntities.length > 0 ? (
        <div className={styles.tags}>
          {protectedEntities.map(relation => (
            <Chip key={relation._uid} tone="ghost">
              {relation._out.name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No protected entities linked.</span>
      )}
    </Drawer>
  );
};
