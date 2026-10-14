import { LoadingState } from '../../../components/LoadingState';

import { DataStewardshipReviewCalendar } from '../sections/DataStewardshipReviewCalendar';
import {
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

export const CaseCalendarHeaderActions = () => (
  <span className="dim mono">queue items by due week</span>
);
