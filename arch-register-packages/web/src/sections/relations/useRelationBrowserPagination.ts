import { useCallback, useEffect, useState } from 'react';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

// Prev/Next + page-size pagination state for the relation browser (#2700), mirroring
// useEntityBrowserPagination.ts's shape for the entity browser.
export const useRelationBrowserPagination = (conditions: FilterCondition[]) => {
  const [pageSize, setPageSize] = useState(200);
  const [pageIndex, setPageIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: conditions intentionally triggers page reset when filters change
  useEffect(() => {
    setPageIndex(0);
  }, [conditions]);

  const handlePageSizeChange = useCallback((value: string | undefined) => {
    const next = Number(value ?? 50);
    setPageSize(Number.isFinite(next) ? next : 50);
    setPageIndex(0);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPageIndex(index => Math.max(index - 1, 0));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageIndex(index => index + 1);
  }, []);

  return {
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    pageIndex,
    pageSize
  };
};
