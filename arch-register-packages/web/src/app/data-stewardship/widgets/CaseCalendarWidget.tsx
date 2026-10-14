import { TbCalendarEvent } from 'react-icons/tb';
import { LoadingState } from '../../../components/LoadingState';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { DataStewardshipReviewCalendar } from '../sections/DataStewardshipReviewCalendar';
import {
  CaseConfigForm,
  DS_CASE_DEFAULTS,
  isCaseConfig,
  NotConfigured,
  useCaseQueue,
  useOpenCase,
  type CaseConfig
} from '../dataStewardshipWidgetSupport';

export const CaseCalendarWidget = ({ config }: { config: CaseConfig }) => {
  const queue = useCaseQueue(config);
  const openCase = useOpenCase();
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  return <DataStewardshipReviewCalendar items={queue.items} onOpenItem={openCase} />;
};

const CaseCalendarHeaderActions = () => <span className="dim mono">queue items by due week</span>;

export const caseCalendarSpec = defineComponent({
  type: 'data-stewardship-case-calendar',
  category: 'visualizations',
  name: 'Next six weeks',
  description: 'Open governance cases bucketed by due week.',
  dashboardWidget: {
    icon: TbCalendarEvent,
    defaultW: 12,
    defaultH: 14,
    surfaces: ['workspace'],
    component: CaseCalendarWidget,
    headerActionsComponent: CaseCalendarHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isCaseConfig,
    createDefaultConfig: () => ({ ...DS_CASE_DEFAULTS, scope: 'mine' }),
    getTitle: () => 'Next six weeks',
    configForm: CaseConfigForm
  }
});
