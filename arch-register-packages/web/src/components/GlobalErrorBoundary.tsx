import React from 'react';
import { AppErrorState } from './AppErrorState';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class GlobalErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught application error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <AppErrorState
          fullScreen
          title="The app hit an unexpected error"
          message="Arch Register could not finish rendering this view. Reload the page to recover the session and retry."
          details={this.state.error.message}
          primaryAction={{ label: 'Reload page', onClick: () => window.location.reload() }}
        />
      );
    }

    return this.props.children;
  }
}
