import type { DiscussionSummaryEntry } from '@arch-register/api-types/discussionContract';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  entityMarkdownRoute,
  projectDetailRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../routes/publicObjectRoutes';

export const discussionRoute = (workspaceSlug: string, entry: DiscussionSummaryEntry) => {
  const { nav } = entry;
  if (nav.type === 'entity') {
    return entityDetailRoute(workspaceSlug, asEntityPublicId(nav.entityPublicId), {
      tab: 'discussions'
    });
  }
  if (nav.type === 'assessment') {
    return projectDetailRoute(workspaceSlug, asProjectPublicId(nav.projectPublicId), {
      section: 'assessments',
      assessmentId: entry.objectId,
      assessmentTab: 'discussion'
    });
  }
  if (nav.entityPublicId) {
    return entityMarkdownRoute(workspaceSlug, asEntityPublicId(nav.entityPublicId), entry.objectId);
  }
  if (nav.projectPublicId) {
    return projectMarkdownRoute(
      workspaceSlug,
      asProjectPublicId(nav.projectPublicId),
      entry.objectId
    );
  }
  return workspaceMarkdownRoute(workspaceSlug, entry.objectId);
};
