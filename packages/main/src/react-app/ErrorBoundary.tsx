import React from 'react';
import type { Application } from '../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';

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

export async function asyncExecuteWithErrorDialog<T>(
  opts: { application: Application; message?: (e: unknown) => string },
  callback: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await callback();
  } catch (error) {
    opts.application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Error',
          message:
            opts.message?.(error) ??
            `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
          okLabel: 'OK',
          cancelLabel: undefined
        },
        () => {}
      )
    );
  }
}

export function executeWithErrorDialog<T>(
  opts: { application: Application; message?: (e: unknown) => string },
  callback: () => T
): T | undefined {
  try {
    return callback();
  } catch (error) {
    opts.application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Error',
          message:
            opts.message?.(error) ??
            `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
          okLabel: 'OK',
          cancelLabel: undefined
        },
        () => {}
      )
    );
  }
}
