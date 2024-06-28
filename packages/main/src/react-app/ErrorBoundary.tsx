import React from 'react';

type Props = { children: React.ReactNode };

export class ErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown) {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.log(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'var(--red-9)', padding: '1rem' }}>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
