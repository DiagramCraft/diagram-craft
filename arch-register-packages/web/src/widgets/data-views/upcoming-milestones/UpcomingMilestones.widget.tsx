/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
import { TbFlag3 } from 'react-icons/tb';
import { noOptionsConfigSchema } from '../../shared/configSchema';
import { defineWidget } from '../../shared/defineWidget';
import { UpcomingMilestonesWidget } from './UpcomingMilestones';
export default defineWidget({
  type: 'upcoming-milestones',
  category: 'data-views',
  name: 'Upcoming milestones',
  description: 'The most recently completed milestone and up to three upcoming ones.',
  icon: TbFlag3,
  component: UpcomingMilestonesWidget,
  configSchema: noOptionsConfigSchema,
  dashboard: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['project']
  }
});
