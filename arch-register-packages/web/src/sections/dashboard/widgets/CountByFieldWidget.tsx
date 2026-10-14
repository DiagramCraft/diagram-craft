import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { StackedBar } from '../../workspace-settings/sub-sections/analytics/analyticsPrimitives';
import { buildCountBuckets } from './countByFieldLogic';
import styles from './CountByFieldWidget.module.css';
import rowStyles from './WidgetRowList.module.css';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { withInitial } from '../../markdown/mdx-components/configSchema';

const FETCH_LIMIT = 1000;

const PALETTE = ['var(--accent-fg)', 'var(--green)', 'var(--warning-fg)', 'var(--text-muted)'];

export const countByFieldWidgetConfigSchema = z.object({
  schemaName: withInitial(z.string().min(1), ''),
  /** Field whose distinct values define the bar segments. */
  fieldId: withInitial(z.string().min(1), '')
});

export type CountByFieldWidgetConfig = z.infer<typeof countByFieldWidgetConfigSchema>;

type Props = {
  config: CountByFieldWidgetConfig;
};

/** Generic breakdown: total entity count plus a stacked bar and legend per value of a field. */
export const CountByFieldWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const enabled = !!workspaceSlug && !!schema;

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled }
  );

  const buckets = useMemo(
    () => buildCountBuckets(entities, schema, config.fieldId),
    [entities, schema, config.fieldId]
  );

  if (!schema && schemas.length > 0) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) {
    return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  }
  if (entities.length === 0) {
    return <div className={`${rowStyles.emptyInline} dim`}>No entities.</div>;
  }

  const colored = buckets.map((bucket, index) => ({
    ...bucket,
    color: PALETTE[index % PALETTE.length]!
  }));

  return (
    <div className={styles.root}>
      <div className={styles.total}>{entities.length}</div>
      <StackedBar buckets={colored} />
      <div className={styles.legend}>
        {colored.map(bucket => (
          <span key={bucket.id} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: bucket.color }} />
            {bucket.label} {bucket.count}
          </span>
        ))}
      </div>
    </div>
  );
};

type CountByFieldConfigFormProps = {
  config: CountByFieldWidgetConfig;
  onChange: (config: CountByFieldWidgetConfig) => void;
};

export const CountByFieldConfigForm = ({ config, onChange }: CountByFieldConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event =>
            onChange({ ...config, schemaName: event.currentTarget.value, fieldId: '' })
          }
        >
          <option value="">Select an entity type…</option>
          {schemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Count by field" required>
        <select
          className={configFormStyles.labelInput}
          value={config.fieldId}
          onChange={event => onChange({ ...config, fieldId: event.currentTarget.value })}
        >
          <option value="">Select a field…</option>
          {(schema?.fields ?? []).map(field => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </select>
      </DialogSection>
    </>
  );
};
