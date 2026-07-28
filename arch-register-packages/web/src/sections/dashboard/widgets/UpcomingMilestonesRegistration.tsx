import type { TElement } from 'platejs';
import { TbFlag3 } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { UpcomingMilestonesWidget } from './UpcomingMilestonesWidget';

export const UPCOMING_MILESTONES_TYPE = 'upcoming-milestones' as const;

interface UpcomingMilestonesSlateElement extends TElement {}

/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
export const upcomingMilestonesSpec = defineMdxComponent<
  UpcomingMilestonesSlateElement,
  Record<string, never>,
  'block'
>({
  component: UpcomingMilestonesWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbFlag3,
    label: 'Upcoming milestones',
    description: 'The most recently completed milestone and up to three upcoming ones.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['project'],
    component: UpcomingMilestonesWidget,
    isValidConfig: (_config): _config is Record<string, never> => true,
    createDefaultConfig: () => ({})
  }
});
