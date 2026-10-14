import { useNavigate } from '@tanstack/react-router';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EmptyState } from '../../components/EmptyState';
import {
  useDataStewardshipQueue,
  type DataStewardshipQueueItem,
  type DataStewardshipQueuePriority
} from './dataStewardshipQueue';
import {
  CASE_COUNT_TONES,
  CASE_WIDGET_SCOPES,
  effectiveCaseKinds,
  filterByCaseKinds,
  isStringArray,
  type CaseCountTone,
  type CaseWidgetScope
} from './dataStewardshipDashboardLogic';
import styles from './sections/DataStewardshipQueueWidget.module.css';
import formStyles from '../../sections/dashboard/WidgetConfigDialog.module.css';

/** Schema name used by these widgets; no capability-specific schema id is stored in config. */
const DATA_ENTITY_SCHEMA_NAME = 'Data Entity';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
export const WARN = 'var(--cmp-fg-warning, #eab308)';

export const PRIORITY_LABEL: Record<DataStewardshipQueuePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export const PRIORITY_TONE: Record<DataStewardshipQueuePriority, string> = {
  high: DANGER,
  medium: WARN,
  low: 'var(--cmp-fg-dim, #9ca3af)'
};

const SCOPE_LABEL: Record<CaseWidgetScope, string> = {
  mine: 'Assigned to me',
  workspace: 'All open items',
  late: 'Past due'
};

export const TONE_COLOR: Record<CaseCountTone, string | undefined> = {
  none: undefined,
  warning: WARN,
  danger: DANGER
};

/**
 * Governance-case widgets share scope and case-kind filters. The schema to join
 * against is resolved by name so dashboard configs remain portable.
 */
export type TitleConfig = Record<string, unknown>;
export type CaseConfig = TitleConfig & { scope: CaseWidgetScope; caseKinds: string[] };
export type CaseCountConfig = CaseConfig & {
  tone: CaseCountTone;
  /** May contain `{count}` and `{due}` (items due within `dueWithinDays`). */
  subtextTemplate: string;
  dueWithinDays: number;
};
export type ReviewsOverdueConfig = TitleConfig & { subtextTemplate: string };

export const isCaseConfig = (config: Record<string, unknown>): config is CaseConfig =>
  typeof config === 'object' &&
  CASE_WIDGET_SCOPES.includes(config.scope as CaseWidgetScope) &&
  isStringArray(config.caseKinds);

export const isCaseCountConfig = (config: Record<string, unknown>): config is CaseCountConfig =>
  isCaseConfig(config) &&
  CASE_COUNT_TONES.includes(config.tone as CaseCountTone) &&
  typeof config.subtextTemplate === 'string' &&
  typeof config.dueWithinDays === 'number';

export const isReviewsOverdueConfig = (
  config: Record<string, unknown>
): config is ReviewsOverdueConfig =>
  typeof config === 'object' && typeof config.subtextTemplate === 'string';

export const useDataStewardshipConfig = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId = schemas.find(schema => schema.name === DATA_ENTITY_SCHEMA_NAME)?.id ?? null;
  return { workspaceSlug, schemaId, isLoading: false, isConfigured: schemaId != null };
};

export const useCaseQueue = (config: CaseConfig) => {
  const ds = useDataStewardshipConfig();
  const queue = useDataStewardshipQueue(
    ds.workspaceSlug,
    ds.schemaId,
    config.scope === 'workspace' ? 'all' : config.scope,
    ds.isConfigured
  );
  const kinds = effectiveCaseKinds(config.caseKinds);
  return {
    ...ds,
    isLoading: ds.isLoading || queue.isLoading,
    items: filterByCaseKinds(queue.items, kinds)
  };
};

/** Opens the case drawer hosted by AppDashboardRouteScreen via its `caseId` search param. */
export const useOpenCase = () => {
  const navigate = useNavigate();
  return (item: DataStewardshipQueueItem) =>
    navigate({
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        caseId: item.case.id
      })) as never
    });
};

export const NotConfigured = () => (
  <EmptyState title="Data stewardship is not configured" compact />
);

export const StatTile = (props: {
  label: string;
  value: number | string;
  sub: string;
  color?: string;
}) => (
  <div className={styles.tile}>
    <div className={styles.tileLabel}>{props.label}</div>
    <div className={styles.tileValue} style={props.color ? { color: props.color } : undefined}>
      {props.value}
    </div>
    <div className={styles.tileSub}>{props.sub}</div>
  </div>
);

const ScopeField = (props: { config: CaseConfig; onChange: (config: CaseConfig) => void }) => (
  <label className={formStyles.optionRow}>
    <span className={formStyles.optionLabel}>Items</span>
    <div className={formStyles.optionControl}>
      <select
        className={formStyles.labelInput}
        value={props.config.scope}
        onChange={event =>
          props.onChange({ ...props.config, scope: event.currentTarget.value as CaseWidgetScope })
        }
      >
        {CASE_WIDGET_SCOPES.map(scope => (
          <option key={scope} value={scope}>
            {SCOPE_LABEL[scope]}
          </option>
        ))}
      </select>
    </div>
  </label>
);

export const CaseConfigForm = ({
  config,
  onChange
}: {
  config: CaseConfig;
  onChange: (config: CaseConfig) => void;
}) => (
  <DialogSection label="Display" required={false}>
    <div className={formStyles.options}>
      <ScopeField config={config} onChange={onChange} />
    </div>
  </DialogSection>
);

export const DS_CASE_DEFAULTS = { caseKinds: [] as string[] };
