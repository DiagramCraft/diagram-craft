import { addons } from 'storybook/manager-api';
import type { TagBadgeParameters } from 'storybook-addon-tag-badges/manager-helpers';

/**
 * One badge per entry (the addon shows only the first matching one in the sidebar), derived from
 * the `mdx` and `dashboard` tags the widget stories carry. A widget available in both gets a
 * combined badge.
 */
const availability = ({ entry }: { entry: { tags?: string[] } }) => {
  const tags = entry.tags ?? [];
  const mdx = tags.includes('mdx');
  const dashboard = tags.includes('dashboard');
  if (mdx && dashboard) {
    return {
      text: 'WD',
      style: 'purple' as const,
      tooltip: 'Can be used in wiki pages and on dashboards'
    };
  }
  if (mdx) {
    return { text: 'W', style: 'blue' as const, tooltip: 'Can be used in wiki pages' };
  }
  return { text: 'D', style: 'green' as const, tooltip: 'Can be used on dashboards' };
};

addons.setConfig({
  tagBadges: [
    {
      tags: ['mdx', 'dashboard'],
      badge: availability,
      display: { sidebar: [{ type: 'component', skipInherited: false }], toolbar: false, mdx: false }
    }
  ] satisfies TagBadgeParameters
});
