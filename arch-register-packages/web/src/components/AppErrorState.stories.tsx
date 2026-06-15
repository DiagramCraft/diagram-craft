import type { Meta, StoryObj } from '@storybook/react';
import { AppErrorState } from './AppErrorState';

const meta = {
  title: 'Components/AppErrorState',
  component: AppErrorState,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    fullScreen: {
      control: 'boolean'
    }
  }
} satisfies Meta<typeof AppErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Unable to load data',
    message: 'We encountered an error while loading your data. Please try again.'
  }
};

export const WithPrimaryAction: Story = {
  args: {
    title: 'Connection failed',
    message: 'Unable to connect to the server. Please check your internet connection.',
    primaryAction: {
      label: 'Retry',
      onClick: () => alert('Retry clicked')
    }
  }
};

export const WithBothActions: Story = {
  args: {
    title: 'Session expired',
    message: 'Your session has expired. Please log in again to continue.',
    primaryAction: {
      label: 'Log in',
      onClick: () => alert('Log in clicked')
    },
    secondaryAction: {
      label: 'Go back',
      onClick: () => alert('Go back clicked')
    }
  }
};

export const WithDetails: Story = {
  args: {
    title: 'API Error',
    message: 'An unexpected error occurred while processing your request.',
    details: `Error: Failed to fetch
  at fetchData (api.ts:42)
  at async loadDiagram (diagram.ts:123)
  at async DiagramView.render (view.tsx:89)

Status: 500 Internal Server Error
Timestamp: 2024-01-15T10:30:45.123Z`,
    primaryAction: {
      label: 'Try again',
      onClick: () => alert('Try again clicked')
    },
    secondaryAction: {
      label: 'Report issue',
      onClick: () => alert('Report issue clicked')
    }
  }
};

export const FullScreen: Story = {
  args: {
    title: 'Application Error',
    message: 'The application encountered a critical error and needs to restart.',
    details: 'TypeError: Cannot read property "id" of undefined',
    primaryAction: {
      label: 'Reload',
      onClick: () => alert('Reload clicked')
    },
    fullScreen: true
  },
  parameters: {
    layout: 'fullscreen'
  }
};

export const NetworkError: Story = {
  args: {
    title: 'Network Error',
    message: 'Unable to reach the server. Please check your connection and try again.',
    primaryAction: {
      label: 'Retry',
      onClick: () => alert('Retry clicked')
    },
    secondaryAction: {
      label: 'Work offline',
      onClick: () => alert('Work offline clicked')
    }
  }
};

export const PermissionDenied: Story = {
  args: {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    secondaryAction: {
      label: 'Go back',
      onClick: () => alert('Go back clicked')
    }
  }
};

export const NotFound: Story = {
  args: {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist or has been moved.',
    primaryAction: {
      label: 'Go to home',
      onClick: () => alert('Go to home clicked')
    }
  }
};

export const ValidationError: Story = {
  args: {
    title: 'Validation Failed',
    message: 'The data you submitted contains errors. Please review and try again.',
    details: `Validation errors:
- Name is required
- Email must be a valid email address
- Password must be at least 8 characters`,
    secondaryAction: {
      label: 'Close',
      onClick: () => alert('Close clicked')
    }
  }
};
