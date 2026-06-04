import React from 'react';
import { useLocation } from '@tanstack/react-router';
import { AppErrorState } from '../components/AppErrorState';

type Props = {
  children: React.ReactNode;
  resetKey: string;
};

type State = {
  error: Error | null;
  lastResetKey: string;
};

class RouteContentBoundaryInner extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }

    return null;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Route content error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <AppErrorState
          fullScreen
          title="This panel crashed"
          message="The surrounding workspace is still available, but this view failed to render. Try reloading the page or navigating away and back."
          details={this.state.error.message}
          primaryAction={{ label: 'Reload page', onClick: () => window.location.reload() }}
        />
      );
    }

    return this.props.children;
  }
}

export const RouteContentBoundary = (props: { children: React.ReactNode }) => {
  const location = useLocation();

  return (
    <RouteContentBoundaryInner resetKey={location.href}>
      {props.children}
    </RouteContentBoundaryInner>
  );
};
