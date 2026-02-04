import { Preview } from '@storybook/react-vite';
import '../src/App.css';
import '../src/index.css';

const preview: Preview = {
  decorators: [
    Story => (
      <div style={{ isolation: 'isolate' }} className={'root'}>
        <Story />
      </div>
    )
  ]
};

export default preview;
