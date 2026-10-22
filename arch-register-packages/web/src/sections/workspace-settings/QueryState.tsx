import type { ComponentProps, ReactNode } from 'react';
import { Banner } from '../../components/Banner';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';

type QueryStateProps = {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Noun phrase, e.g. "webhooks". Produces "Loading webhooks…" and "Failed to load webhooks." */
  subject: string;
  empty?: ComponentProps<typeof EmptyState>;
  children: ReactNode;
};

export const QueryState = ({
  isLoading,
  error,
  isEmpty,
  subject,
  empty,
  children
}: QueryStateProps) => {
  if (error) return <Banner variant="error">Failed to load {subject}.</Banner>;
  if (isLoading) return <LoadingState text={`Loading ${subject}…`} size="sm" />;
  if (isEmpty && empty) return <EmptyState {...empty} />;
  return <>{children}</>;
};
