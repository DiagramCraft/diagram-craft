import { useNavigate } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { TbAlertTriangle, TbCalendarEvent, TbClipboardCheck, TbListCheck } from 'react-icons/tb';
import { DialogSection } from '../../sections/markdown/editor/BlockDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { useEntities } from '../../hooks/useEntities';
import { useDateTimeFormatPreference } from '../../hooks/useDateTimeFormatPreference';
import { dueLabel, dueTone } from '../../utils/assessmentDueTone';
import { caseKindLabel } from '../../utils/governanceCaseLabels';
import { formatDate } from '../../utils/dateFormat';
/** Name of the schema the Data Stewardship widgets operate on (resolved by name, no capability binding). */
const DATA_ENTITY_SCHEMA_NAME = 'Data Entity';
import {
  queueItemPriority,
  useDataStewardshipQueue,
  type DataStewardshipQueueItem,
  type DataStewardshipQueuePriority
} from './dataStewardshipQueue';
import {
  CASE_COUNT_TONES,
  CASE_WIDGET_SCOPES,
  countDueWithin,
  effectiveCaseKinds,
  filterByCaseKinds,
  isStringArray,
  renderSubtext,
  sortByDueDate,
  type CaseCountTone,
  type CaseWidgetScope
} from './dataStewardshipDashboardLogic';
import { DataStewardshipReviewCalendar } from './sections/DataStewardshipReviewCalendar';
import type { DashboardWidgetSpec } from '../../sections/markdown/mdx-components/types';
import styles from './sections/DataStewardshipQueueWidget.module.css';
import formStyles from '../../sections/dashboard/WidgetConfigDialog.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

const PRIORITY_LABEL: Record<DataStewardshipQueuePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const PRIORITY_TONE: Record<DataStewardshipQueuePriority, string> = {
  high: DANGER,
  medium: WARN,
  low: 'var(--cmp-fg-dim, #9ca3af)'
};

const SCOPE_LABEL: Record<CaseWidgetScope, string> = {
  mine: 'Assigned to me',
  workspace: 'All open items',
  late: 'Past due'
};

const TONE_COLOR: Record<CaseCountTone, string | undefined> = {
  none: undefined,
  warning: WARN,
  danger: DANGER
};

/**
 * Governance-case widgets (count / queue / calendar) are parameterised by `scope` and `caseKinds`
 * so they can later serve other case kinds; today they resolve the schema to join against from
 * the Data Stewardship capability config, so seeds don't need a workspace-specific schema id.
 */
type TitleConfig = Record<string, unknown> & { label?: string };
type CaseConfig = TitleConfig & { scope: CaseWidgetScope; caseKinds: string[] };
type CaseCountConfig = CaseConfig & {
  tone: CaseCountTone;
  /** May contain `{count}` and `{due}` (items due within `dueWithinDays`). */
  subtextTemplate: string;
  dueWithinDays: number;
};
type ReviewsOverdueConfig = TitleConfig & { subtextTemplate: string };

const isTitleConfig = (config: Record<string, unknown>): config is TitleConfig =>
  config.label === undefined || typeof config.label === 'string';

const isCaseConfig = (config: Record<string, unknown>): config is CaseConfig =>
  isTitleConfig(config) &&
  CASE_WIDGET_SCOPES.includes(config.scope as CaseWidgetScope) &&
  isStringArray(config.caseKinds);

const isCaseCountConfig = (config: Record<string, unknown>): config is CaseCountConfig =>
  isCaseConfig(config) &&
  CASE_COUNT_TONES.includes(config.tone as CaseCountTone) &&
  typeof config.subtextTemplate === 'string' &&
  typeof config.dueWithinDays === 'number';

const isReviewsOverdueConfig = (config: Record<string, unknown>): config is ReviewsOverdueConfig =>
  isTitleConfig(config) && typeof config.subtextTemplate === 'string';

const titleFor = (config: TitleConfig, fallback: string): string => {
  const label = config.label?.trim();
  return label === undefined || label.length === 0 ? fallback : label;
};

const useDataStewardshipConfig = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId = schemas.find(schema => schema.name === DATA_ENTITY_SCHEMA_NAME)?.id ?? null;
  return {
    workspaceSlug,
    schemaId,
    isLoading: false,
    isConfigured: schemaId != null
  };
};

const useCaseQueue = (config: CaseConfig) => {
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

/** Opens the case drawer, hosted by `AppDashboardRouteScreen`, via the `caseId` param. */
const useOpenCase = () => {
  const navigate = useNavigate();
  return (item: DataStewardshipQueueItem) =>
    navigate({
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        caseId: item.case.id
      })) as never
    });
};

const NotConfigured = () => <EmptyState title="Data stewardship is not configured" compact />;

const StatTile = (props: {
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

const CaseCountWidget = ({ config }: { config: CaseCountConfig }) => {
  const queue = useCaseQueue(config);
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  const count = queue.items.length;
  const due = countDueWithin(queue.items, config.dueWithinDays);
  return (
    <StatTile
      label={titleFor(config, 'Cases')}
      value={count}
      sub={renderSubtext(config.subtextTemplate, count, due)}
      color={count > 0 ? TONE_COLOR[config.tone] : undefined}
    />
  );
};

const ReviewsOverdueWidget = ({ config }: { config: ReviewsOverdueConfig }) => {
  const ds = useDataStewardshipConfig();
  const datasets = useEntities(
    ds.workspaceSlug,
    { schemaId: ds.schemaId ?? undefined, view: 'full', limit: 500 },
    { enabled: ds.isConfigured }
  );
  if (ds.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!ds.isConfigured) return <NotConfigured />;
  const count = datasets.data.filter(entity => entity.review_status === 'overdue').length;
  return (
    <StatTile
      label={titleFor(config, 'Reviews overdue')}
      value={count}
      sub={renderSubtext(config.subtextTemplate, count, 0)}
      color={count > 0 ? WARN : undefined}
    />
  );
};

const CaseQueueWidget = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  const openCase = useOpenCase();
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  if (queue.isLoading) return <LoadingState text="Loading queue…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  if (queue.items.length === 0) return <EmptyState title="Nothing matches this filter." compact />;

  return (
    <div className={styles.queue}>
      {sortByDueDate(queue.items).map(item => {
        const priority = queueItemPriority(item.case);
        return (
          <button
            key={item.case.id}
            type="button"
            className={styles.card}
            style={{ '--tone': PRIORITY_TONE[priority] } as CSSProperties}
            onClick={() => openCase(item)}
          >
            <span className={styles.cardTick} />
            <span className={styles.cardBody}>
              <span className={styles.cardHd}>
                <span className={styles.cardKind}>
                  {caseKindLabel(item.case.caseKind, item.case.payload)}
                </span>
                <span className={styles.pill} style={{ color: PRIORITY_TONE[priority] }}>
                  {PRIORITY_LABEL[priority]}
                </span>
                <span className={`${styles.cardKind} mono`}>{item.case.id.slice(0, 8)}</span>
              </span>
              <span className={styles.cardTitle}>{item.dataset._name}</span>
              <span className={styles.cardMeta}>
                <span>{item.dataset._publicId}</span>
              </span>
            </span>
            <span className={styles.cardDue} style={{ color: dueTone(item.case.dueAt) }}>
              {dueLabel(item.case.dueAt)}
              <span className={styles.cardDueDate}>
                {item.case.dueAt ? formatDate(item.case.dueAt, '', dateTimeFormatPreference) : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const CaseQueueHeaderActions = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  return <span className="dim mono">{queue.isLoading ? '' : queue.items.length}</span>;
};

const CaseCalendarWidget = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  const openCase = useOpenCase();
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  return <DataStewardshipReviewCalendar items={queue.items} onOpenItem={openCase} />;
};

const CaseCalendarHeaderActions = () => <span className="dim mono">queue items by due week</span>;

const TitleField = (props: { config: TitleConfig; onChange: (config: never) => void }) => (
  <label className={formStyles.optionRow}>
    <span className={formStyles.optionLabel}>Title</span>
    <div className={formStyles.optionControl}>
      <input
        type="text"
        className={formStyles.labelInput}
        value={props.config.label ?? ''}
        placeholder="Use the widget name"
        onChange={event => {
          const value = event.currentTarget.value;
          props.onChange({
            ...props.config,
            label: value.trim() === '' ? undefined : value
          } as never);
        }}
      />
    </div>
  </label>
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

const TitleConfigForm = ({
  config,
  onChange
}: {
  config: TitleConfig;
  onChange: (config: TitleConfig) => void;
}) => (
  <DialogSection label="Display" required={false}>
    <div className={formStyles.options}>
      <TitleField config={config} onChange={onChange} />
    </div>
  </DialogSection>
);

const CaseConfigForm = ({
  config,
  onChange
}: {
  config: CaseConfig;
  onChange: (config: CaseConfig) => void;
}) => (
  <DialogSection label="Display" required={false}>
    <div className={formStyles.options}>
      <TitleField config={config} onChange={onChange} />
      <ScopeField config={config} onChange={onChange} />
    </div>
  </DialogSection>
);

const DS_CASE_DEFAULTS = { caseKinds: [] as string[] };

export const dataStewardshipDashboardWidgetSpecs: Array<{
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: this registry intentionally erases per-widget config types
  spec: DashboardWidgetSpec<any>;
}> = [
  {
    type: 'data-stewardship-case-count',
    spec: {
      icon: TbAlertTriangle,
      label: 'Case count',
      description: 'Number of open governance cases, filtered by scope and case kind.',
      defaultW: 3,
      defaultH: 5,
      surfaces: ['workspace'],
      component: CaseCountWidget,
      frame: { hideOutsideEdit: true, padded: false, showIcon: false },
      isValidConfig: isCaseCountConfig,
      createDefaultConfig: (): CaseCountConfig => ({
        ...DS_CASE_DEFAULTS,
        scope: 'mine',
        label: 'Assigned to me',
        tone: 'none',
        subtextTemplate: '{due} due within a week',
        dueWithinDays: 7
      }),
      getTitle: (config: CaseCountConfig) => titleFor(config, 'Case count'),
      configForm: CaseConfigForm
    }
  },
  {
    type: 'data-stewardship-reviews-overdue',
    spec: {
      icon: TbListCheck,
      label: 'Reviews overdue',
      description: 'Datasets whose scheduled review date has passed.',
      defaultW: 3,
      defaultH: 5,
      surfaces: ['workspace'],
      component: ReviewsOverdueWidget,
      frame: { hideOutsideEdit: true, padded: false, showIcon: false },
      isValidConfig: isReviewsOverdueConfig,
      createDefaultConfig: (): ReviewsOverdueConfig => ({
        subtextTemplate: 'scheduled review date passed'
      }),
      getTitle: (config: ReviewsOverdueConfig) => titleFor(config, 'Reviews overdue'),
      configForm: TitleConfigForm
    }
  },
  {
    type: 'data-stewardship-case-calendar',
    spec: {
      icon: TbCalendarEvent,
      label: 'Next six weeks',
      description: 'Open governance cases bucketed by due week.',
      defaultW: 12,
      defaultH: 14,
      surfaces: ['workspace'],
      component: CaseCalendarWidget,
      headerActionsComponent: CaseCalendarHeaderActions,
      frame: { padded: false, showIcon: false },
      isValidConfig: isCaseConfig,
      createDefaultConfig: (): CaseConfig => ({
        ...DS_CASE_DEFAULTS,
        scope: 'mine',
        label: 'Next six weeks'
      }),
      getTitle: (config: CaseConfig) => titleFor(config, 'Next six weeks'),
      configForm: CaseConfigForm
    }
  },
  {
    type: 'data-stewardship-case-queue',
    spec: {
      icon: TbClipboardCheck,
      label: 'Case queue',
      description: 'Open governance cases, oldest deadline first, with derived priority.',
      defaultW: 12,
      defaultH: 22,
      surfaces: ['workspace'],
      component: CaseQueueWidget,
      headerActionsComponent: CaseQueueHeaderActions,
      frame: { padded: false, showIcon: false },
      isValidConfig: isCaseConfig,
      createDefaultConfig: (): CaseConfig => ({
        ...DS_CASE_DEFAULTS,
        scope: 'mine',
        label: 'Assigned to me'
      }),
      getTitle: (config: CaseConfig) => titleFor(config, 'Case queue'),
      configForm: CaseConfigForm
    }
  }
];
