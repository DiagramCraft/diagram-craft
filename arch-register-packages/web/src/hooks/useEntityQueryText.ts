import { useMutation } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

// Wraps entityQuery.{parseText,printText} (specs/QUERY_LANGUAGE.md §4) — mutations rather than
// queries since callers trigger these on demand (debounced typing, mode switch), not as a
// cache-keyed read.

export const useParseEntityQueryText = (workspaceId: string) =>
  useMutation({
    mutationFn: (text: string) =>
      orpcClient.entityQueryText.parseText({
        params: { workspace: workspaceId },
        query: { text }
      })
  });

export const usePrintEntityQueryText = (workspaceId: string) =>
  useMutation({
    mutationFn: (
      query: Parameters<typeof orpcClient.entityQueryText.printText>[0]['body']['query']
    ) =>
      orpcClient.entityQueryText.printText({
        params: { workspace: workspaceId },
        body: { query }
      })
  });
