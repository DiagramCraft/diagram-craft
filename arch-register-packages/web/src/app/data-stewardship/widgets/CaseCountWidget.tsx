import { TbAlertTriangle } from 'react-icons/tb';
import { LoadingState } from '../../../components/LoadingState';
import { useWidgetBodyTitle } from '../../../sections/dashboard/widgets/WidgetBodyTitle';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { countDueWithin, renderSubtext } from '../dataStewardshipDashboardLogic';
import {
  CaseConfigForm,
  DS_CASE_DEFAULTS,
  isCaseCountConfig,
  NotConfigured,
  StatTile,
  TONE_COLOR,
  useCaseQueue,
  type CaseCountConfig
} from '../dataStewardshipWidgetSupport';

export const CaseCountWidget = ({ config }: { config: CaseCountConfig }) => {
  const title = useWidgetBodyTitle();
  const queue = useCaseQueue(config);
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  const count = queue.items.length;
  const due = countDueWithin(queue.items, config.dueWithinDays);
  return (
    <StatTile
      label={title ?? 'Cases'}
      value={count}
      sub={renderSubtext(config.subtextTemplate, count, due)}
      color={count > 0 ? TONE_COLOR[config.tone] : undefined}
    />
  );
};

export const caseCountSpec = defineComponent({
  type: 'data-stewardship-case-count',
  category: 'metrics',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'Case count',
    description: 'Number of open governance cases, filtered by scope and case kind.',
    defaultW: 3,
    defaultH: 5,
    surfaces: ['workspace'],
    component: CaseCountWidget,
    frame: { hideOutsideEdit: true, padded: false, showIcon: false },
    isValidConfig: isCaseCountConfig,
    createDefaultConfig: () => ({
      ...DS_CASE_DEFAULTS,
      scope: 'mine',
      tone: 'none',
      subtextTemplate: '{due} due within a week',
      dueWithinDays: 7
    }),
    configForm: CaseConfigForm
  }
});
