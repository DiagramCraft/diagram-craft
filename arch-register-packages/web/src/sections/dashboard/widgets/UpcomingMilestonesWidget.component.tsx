/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
import { TbFlag3 } from 'react-icons/tb';
import { noOptionsConfigSchema, schemaGuard } from '../../markdown/mdx-components/configSchema';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import { UPCOMING_MILESTONES_TYPE, UpcomingMilestonesWidget } from './UpcomingMilestonesWidget';
export default defineComponent({
  type: UPCOMING_MILESTONES_TYPE,
  category: 'metrics',
  name: 'Upcoming milestones',
  description: 'The most recently completed milestone and up to three upcoming ones.',
  icon: TbFlag3,
  component: UpcomingMilestonesWidget,
  createDefaultProps: () => ({ config: {} }),
  dashboardWidget: {
    defaultW: 3,
    defaultH: 8,
    surfaces: ['project'],
    isValidConfig: schemaGuard(noOptionsConfigSchema)
  }
});
