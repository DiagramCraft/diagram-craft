import { useCallback, useEffect, useState } from 'react';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

type UseEntityBrowserPaginationProps = {
  isPagedBrowse: boolean;
  q: string;
  conditions: FilterCondition[];
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  projectId?: string;
  collectionId?: string | null;
  projectScope: 'project' | 'all';
};

export const useEntityBrowserPagination = ({
  isPagedBrowse,
  q,
  conditions,
  typeFilter,
  ownerFilter,
  statusFilter,
  projectId,
  collectionId,
  projectScope
}: UseEntityBrowserPaginationProps) => {
  const [pageSize, setPageSize] = useState(200);
  const [pageIndex, setPageIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: extra deps intentionally trigger page reset when filters change
  useEffect(() => {
    if (!isPagedBrowse) return;
    setPageIndex(0);
  }, [
    isPagedBrowse,
    q,
    conditions,
    typeFilter,
    ownerFilter,
    statusFilter,
    projectId,
    collectionId,
    projectScope
  ]);

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
    pageSize,
    setPageIndex
  };
};
