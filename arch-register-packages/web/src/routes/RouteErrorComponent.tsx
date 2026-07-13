import type { ErrorComponentProps } from '@tanstack/react-router';
import { ApiError } from '../lib/http';
import { AppErrorState } from '../components/AppErrorState';

export const getRouteErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return {
        title: 'The server could not be reached',
        message: 'Check your connection and try again.',
        details: error.message
      };
    }

    if (error.status === 403) {
      return {
        title: 'You do not have access to this view',
        message:
          'Your account is signed in, but this action is not permitted with the current permissions.',
        details: error.message
      };
    }

    if (error.status !== undefined && error.status >= 500) {
      return {
        title: 'The server could not complete this request',
        message: 'Try again in a moment. If the problem persists, reload the page and retry.',
        details: error.message
      };
    }
  }

  return {
    title: 'This view could not be loaded',
    message:
      'Part of Arch Register failed while preparing the page. You can retry this view or reload the app.',
    details: error instanceof Error ? error.message : null
  };
};

export const RouteErrorComponent = ({ error, reset }: ErrorComponentProps) => {
  const copy = getRouteErrorMessage(error);

  return (
    <AppErrorState
      fullScreen
      title={copy.title}
      message={copy.message}
      details={copy.details}
      primaryAction={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Reload page', onClick: () => window.location.reload() }}
    />
  );
};
