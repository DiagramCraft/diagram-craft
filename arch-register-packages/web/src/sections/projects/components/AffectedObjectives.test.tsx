import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AffectedObjective, AffectedObjectivesState } from './affectedObjectives';
import { AffectedObjectivesMemberLine, AffectedObjectivesSummary } from './AffectedObjectivesPanel';

vi.mock('../../../components/EntityNavigationLink', () => ({
  EntityNavigationLink: ({
    publicId,
    children,
    ...props
  }: {
    publicId: string;
    children: ReactNode;
  }) => (
    <a href={`/entities/${publicId}`} {...props}>
      {children}
    </a>
  )
}));

const objectives: AffectedObjective[] = [
  { id: 'objective-a', name: 'Alpha' },
  { id: 'objective-b', name: 'Beta' }
];

const readyState: AffectedObjectivesState = {
  status: 'ready',
  byMember: new Map([['entity-1', objectives]]),
  objectives
};

describe('AffectedObjectivesSummary', () => {
  it('renders navigable case-level objectives and per-member attribution', () => {
    const summary = renderToStaticMarkup(<AffectedObjectivesSummary state={readyState} />);
    const member = renderToStaticMarkup(
      <AffectedObjectivesMemberLine state={readyState} memberKey="entity-1" isDraft={false} />
    );

    expect(summary).toContain('Affected objectives');
    expect(summary).toContain('Derived from the selected entities');
    expect(summary).toContain('<a href="/entities/objective-a"');
    expect(summary).toContain('Alpha');
    expect(summary).toContain('Beta');
    expect(member).toContain('Affected by: Alpha, Beta');
  });

  it('renders non-blocking states and excludes hidden summaries', () => {
    expect(
      renderToStaticMarkup(
        <AffectedObjectivesSummary state={{ ...readyState, status: 'loading' }} />
      )
    ).toContain('Loading objectives');
    expect(
      renderToStaticMarkup(
        <AffectedObjectivesSummary
          state={{ status: 'ready', byMember: new Map(), objectives: [] }}
        />
      )
    ).toContain('No affected objectives');
    expect(
      renderToStaticMarkup(
        <AffectedObjectivesMemberLine state={readyState} memberKey="draft:new" isDraft={true} />
      )
    ).toContain('No current objective links');
    expect(
      renderToStaticMarkup(
        <AffectedObjectivesSummary state={{ ...readyState, status: 'hidden' }} />
      )
    ).toBe('');
  });
});
