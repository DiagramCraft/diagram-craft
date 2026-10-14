import { useMemo } from 'react';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { BarList } from '../../../components/BarList';
import { ratioColor } from '../../../components/bandColor';
import { buildRatioBarRows } from './ratioBarListLogic';
import styles from './WidgetRowList.module.css';
import { TbChartBar } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

const FETCH_LIMIT = 500;

export type RatioBarListWidgetConfig = {
  schemaName: string;
  /** Field whose value defines a bar (one bar per distinct value). */
  groupByFieldId: string;
  /** A bar's filled share is the entities with `numeratorFieldId = numeratorValue`. */
  numeratorFieldId: string;
  numeratorValue: string;
};

type Props = {
  config: RatioBarListWidgetConfig;
};

export const isRatioBarListConfigComplete = (config: RatioBarListWidgetConfig): boolean =>
  !!config.schemaName &&
  !!config.groupByFieldId &&
  !!config.numeratorFieldId &&
  !!config.numeratorValue;

/**
 * Generic ratio/coverage bar-list: one bar per distinct value of a field, filled to the share of
 * that group's entities matching a numerator field value, coloured by `ratioColor`.
 */
export const RatioBarListWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);
  const enabled = !!workspaceSlug && !!schema && isRatioBarListConfigComplete(config);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled }
  );

  const rows = useMemo(
    () =>
      buildRatioBarRows(entities, schema, {
        groupByFieldId: config.groupByFieldId,
        numeratorFieldId: config.numeratorFieldId,
        numeratorValue: config.numeratorValue
      }),
    [entities, schema, config.groupByFieldId, config.numeratorFieldId, config.numeratorValue]
  );

  if (!isRatioBarListConfigComplete(config) || (!schema && schemas.length > 0)) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }
  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading…</div>;
  }

  return (
    <BarList
      rows={rows}
      getColor={row => ratioColor(row.effective, row.total)}
      emptyMessage="No entities."
    />
  );
};

type RatioBarListConfigFormProps = {
  config: RatioBarListWidgetConfig;
  onChange: (config: RatioBarListWidgetConfig) => void;
};

export const RatioBarListConfigForm = ({ config, onChange }: RatioBarListConfigFormProps) => {
  const { schemas } = useWorkspaceContext();
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const textOption = (
    label: string,
    value: string,
    onValue: (value: string) => void,
    placeholder?: string
  ) => (
    <label className={configFormStyles.optionRow}>
      <span className={configFormStyles.optionLabel}>{label}</span>
      <div className={configFormStyles.optionControl}>
        <input
          type="text"
          className={configFormStyles.labelInput}
          value={value}
          placeholder={placeholder}
          onChange={event => onValue(event.currentTarget.value)}
        />
      </div>
    </label>
  );

  return (
    <>
      <DialogSection label="Entity type" required>
        <select
          className={configFormStyles.labelInput}
          value={config.schemaName}
          onChange={event => onChange({ ...config, schemaName: event.currentTarget.value })}
        >
          <option value="">Select an entity type…</option>
          {schemas.map(candidate => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
      </DialogSection>
      <DialogSection label="Bars" required>
        <div className={configFormStyles.options}>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Group by</span>
            <div className={configFormStyles.optionControl}>
              <select
                className={configFormStyles.labelInput}
                value={config.groupByFieldId}
                onChange={event =>
                  onChange({ ...config, groupByFieldId: event.currentTarget.value })
                }
              >
                <option value="">Select a field…</option>
                {(schema?.fields ?? []).map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className={configFormStyles.optionRow}>
            <span className={configFormStyles.optionLabel}>Filled when field</span>
            <div className={configFormStyles.optionControl}>
              <select
                className={configFormStyles.labelInput}
                value={config.numeratorFieldId}
                onChange={event =>
                  onChange({ ...config, numeratorFieldId: event.currentTarget.value })
                }
              >
                <option value="">Select a field…</option>
                {(schema?.fields ?? []).map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </label>
          {textOption(
            'Equals value',
            config.numeratorValue,
            value => onChange({ ...config, numeratorValue: value }),
            'e.g. effective'
          )}
        </div>
      </DialogSection>
      <DialogSection label="Display" required={false}>
        <div className={configFormStyles.options}></div>
      </DialogSection>
    </>
  );
};

export const RATIO_BAR_LIST_TYPE = 'RatioBarList' as const;

export const _ratioBarListSpecData: Omit<
  DashboardWidgetSpec<RatioBarListWidgetConfig>,
  'label' | 'description'
> = {
  icon: TbChartBar,
  defaultW: 6,
  defaultH: 16,
  surfaces: ['workspace'],
  component: RatioBarListWidget,
  isValidConfig: (config): config is RatioBarListWidgetConfig =>
    typeof config.schemaName === 'string' &&
    typeof config.groupByFieldId === 'string' &&
    typeof config.numeratorFieldId === 'string' &&
    typeof config.numeratorValue === 'string' &&
    isRatioBarListConfigComplete(config as RatioBarListWidgetConfig),
  createDefaultConfig: () => ({
    schemaName: '',
    groupByFieldId: '',
    numeratorFieldId: '',
    numeratorValue: ''
  }),
  configForm: RatioBarListConfigForm
};
