import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssessmentList, AssessmentListToolbar } from './AssessmentList';

describe('assessment list', () => {
  it('renders status filters with the coordinated counts', () => {
    const markup = renderToStaticMarkup(
      <AssessmentListToolbar
        statusFilter="default"
        counts={{ default: 2, draft: 1, archived: 3, all: 6 }}
        onStatusFilterChange={() => undefined}
      />
    );

    expect(markup).toContain('Open / Closed (2)');
    expect(markup).toContain('Draft (1)');
    expect(markup).toContain('Archived (3)');
    expect(markup).toContain('All (6)');
  });

  it('renders the filtered empty state and creation action', () => {
    const markup = renderToStaticMarkup(
      <AssessmentList
        assessments={[]}
        statusFilter="draft"
        schemas={[]}
        canEdit
        onCreate={() => undefined}
        onOpen={() => undefined}
      />
    );

    expect(markup).toContain('No draft assessments');
    expect(markup).toContain('New assessment');
  });
});
