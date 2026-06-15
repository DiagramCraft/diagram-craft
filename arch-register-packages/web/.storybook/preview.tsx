import { Preview } from '@storybook/react-vite';
import '../src/tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      disable: true
    }
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'dark';
      
      // Apply theme to document root
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        const body = document.body;
        
        if (theme === 'light') {
          root.setAttribute('data-theme', 'light');
          root.classList.remove('dark', 'dark-theme');
          root.classList.add('light-theme');
          body.classList.remove('dark-theme');
          body.classList.add('light-theme');
        } else {
          root.removeAttribute('data-theme');
          root.classList.remove('light-theme');
          root.classList.add('dark', 'dark-theme');
          body.classList.remove('light-theme');
          body.classList.add('dark-theme');
        }
      }
      
      return (
        <div className="ar-app" style={{ isolation: 'isolate', minHeight: '100vh', background: 'var(--base-bg)', color: 'var(--base-fg)' }}>
          <Story />
        </div>
      );
    }
  ]
};

export default preview;
