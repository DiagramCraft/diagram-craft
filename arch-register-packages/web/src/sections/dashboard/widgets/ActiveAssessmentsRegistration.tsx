import type { TElement } from 'platejs';
import { TbClipboardCheck } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { ActiveAssessmentsWidget } from './ActiveAssessmentsWidget';

export const ACTIVE_ASSESSMENTS_TYPE = 'active-assessments' as const;

interface ActiveAssessmentsSlateElement extends TElement {}

/**
 * Dashboard-only widget: no editorSpec, so it never appears in the wiki
 * slash-command menu or MDX round-trip. Not authorable in wiki markdown.
 */
export const activeAssessmentsSpec = defineMdxComponent<
  ActiveAssessmentsSlateElement,
  Record<string, never>,
  'block'
>({
  component: ActiveAssessmentsWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbClipboardCheck,
    label: 'Active assessments',
    description: 'Up to four active assessments for the project.',
    defaultW: 3,
    defaultH: 2,
    surfaces: ['project'],
    component: ActiveAssessmentsWidget,
    isValidConfig: (_config): _config is Record<string, never> => true,
    createDefaultConfig: () => ({})
  }
});
