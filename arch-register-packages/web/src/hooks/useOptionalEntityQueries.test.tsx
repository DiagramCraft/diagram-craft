// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssessments } from './useAssessments';
import { useAssessmentResponses } from './useAssessmentResponses';
import { useCollections } from './useCollections';
import { useEntityFacets, useTimelineMarkers } from './useEntities';
import { usePinnedEntities } from './useNotifications';
import { useSavedViews } from './useSavedViews';
import { useJoinedAssessment } from '../sections/entities/components/useJoinedAssessment';

const mocks = vi.hoisted(() => ({
  listViews: vi.fn(),
  listCollections: vi.fn(),
  listPinnedEntities: vi.fn(),
  listFacets: vi.fn(),
  listTimelineMarkers: vi.fn(),
  listAssessments: vi.fn(),
  listAssessmentResponses: vi.fn()
}));

vi.mock('../lib/orpcClient', () => ({
  orpcClient: {
    views: { list: mocks.listViews },
    collections: { list: mocks.listCollections },
    pinnedEntities: { list: mocks.listPinnedEntities },
    entities: { facets: mocks.listFacets, timelineMarkers: mocks.listTimelineMarkers },
    assessments: { list: mocks.listAssessments },
    assessmentResponses: { list: mocks.listAssessmentResponses }
  }
}));

const QueryHarness = ({
  filters,
  views,
  bookmarks,
  assessments
}: {
  filters: boolean;
  views: boolean;
  bookmarks: boolean;
  assessments: boolean;
}) => {
  useEntityFacets('workspace', filters);
  useSavedViews('workspace', { enabled: views });
  usePinnedEntities('workspace', bookmarks);
  useCollections('workspace', undefined, { enabled: bookmarks });
  useAssessments('workspace', assessments);
  useAssessmentResponses('workspace', '');
  return null;
};

const JoinedAssessmentHarness = ({ enabled }: { enabled: boolean }) => {
  useJoinedAssessment('workspace', null, undefined, [], enabled);
  return null;
};

describe('optional entity queries', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mocks.listViews.mockResolvedValue([]);
    mocks.listCollections.mockResolvedValue([]);
    mocks.listPinnedEntities.mockResolvedValue([]);
    mocks.listFacets.mockResolvedValue({ total: 0, schema: [], lifecycle: [], owner: [] });
    mocks.listTimelineMarkers.mockResolvedValue([]);
    mocks.listAssessments.mockResolvedValue([]);
    mocks.listAssessmentResponses.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('does not request inactive entity-browser datasets', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <QueryHarness filters views={false} bookmarks={false} assessments={false} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(mocks.listFacets).toHaveBeenCalledTimes(1);
    expect(mocks.listTimelineMarkers).not.toHaveBeenCalled();
    expect(mocks.listViews).not.toHaveBeenCalled();
    expect(mocks.listCollections).not.toHaveBeenCalled();
    expect(mocks.listPinnedEntities).not.toHaveBeenCalled();
    expect(mocks.listAssessments).not.toHaveBeenCalled();
    expect(mocks.listAssessmentResponses).not.toHaveBeenCalled();
  });

  it('starts optional requests when their features become enabled', async () => {
    const FeatureHarness = () => {
      const [enabled, setEnabled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setEnabled(true)}>
            enable
          </button>
          <QueryHarness filters views={enabled} bookmarks={enabled} assessments={enabled} />
        </>
      );
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <FeatureHarness />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(mocks.listViews).toHaveBeenCalledTimes(1);
    expect(mocks.listCollections).toHaveBeenCalledTimes(1);
    expect(mocks.listPinnedEntities).toHaveBeenCalledTimes(1);
    expect(mocks.listAssessments).toHaveBeenCalledTimes(1);
  });

  it('starts timeline marker requests when the timeline becomes enabled', async () => {
    const TimelineHarness = () => {
      const [enabled, setEnabled] = useState(false);
      useTimelineMarkers('workspace', enabled);
      return (
        <>
          <button type="button" onClick={() => setEnabled(true)}>
            enable timeline
          </button>
        </>
      );
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TimelineHarness />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(mocks.listTimelineMarkers).not.toHaveBeenCalled();

    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(mocks.listTimelineMarkers).toHaveBeenCalledTimes(1);
  });

  it('keeps assessment data disabled until the picker or URL enables it', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <JoinedAssessmentHarness enabled={false} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(mocks.listAssessments).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <JoinedAssessmentHarness enabled />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(mocks.listAssessments).toHaveBeenCalledTimes(1);
  });
});
