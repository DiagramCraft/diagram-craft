import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyntaxHighlightingEditor } from './SyntaxHighlightingEditor';
import { themeDecorator } from '../.storybook/common';
import { useState } from 'react';

const meta = {
  title: 'Components/SyntaxHighlightingEditor',
  component: SyntaxHighlightingEditor,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof SyntaxHighlightingEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

const sampleCode = `rectangle "My Box"
circle "My Circle" at (100, 100)
arrow from "My Box" to "My Circle"`;

export const Primary: Story = {
  args: {
    value: sampleCode,
    onChange: () => {},
    style: { width: '500px', height: '300px' }
  }
};

export const WithSyntaxHighlighting: Story = {
  args: {
    value: sampleCode
  },
  render: () => {
    const [value, setValue] = useState(sampleCode);

    const highlighter = (lines: string[]) => {
      return lines.map(line => {
        // Simple highlighting: keywords in blue, strings in green
        return line
          .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
          .replace(
            /\b(rectangle|circle|arrow|from|to|at)\b/g,
            '<span class="syntax-label">$1</span>'
          )
          .replace(/\(/g, '<span class="syntax-bracket">(</span>')
          .replace(/\)/g, '<span class="syntax-bracket">)</span>');
      });
    };

    return (
      <SyntaxHighlightingEditor
        value={value}
        onChange={setValue}
        highlighter={highlighter}
        style={{ width: '500px', height: '300px' }}
      />
    );
  }
};

export const WithErrors: Story = {
  args: {
    value: sampleCode
  },
  render: () => {
    const [value, setValue] = useState(`rectangle "Box 1"
invalid syntax here
circle "Circle 1"
another error`);

    const errors = new Map<number, string>([
      [1, 'Syntax error: Expected shape type'],
      [3, 'Invalid command format']
    ]);

    const highlighter = (lines: string[]) => {
      return lines.map(line => {
        return line
          .replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>')
          .replace(
            /\b(rectangle|circle|arrow|from|to|at)\b/g,
            '<span class="syntax-label">$1</span>'
          );
      });
    };

    return (
      <SyntaxHighlightingEditor
        value={value}
        onChange={setValue}
        highlighter={highlighter}
        errors={errors}
        style={{ width: '500px', height: '300px' }}
      />
    );
  }
};

export const Disabled: Story = {
  args: {
    value: sampleCode,
    onChange: () => {},
    disabled: true,
    style: { width: '500px', height: '300px' }
  }
};

export const WithKeyboardShortcut: Story = {
  args: {
    value: sampleCode
  },
  render: () => {
    const [value, setValue] = useState(sampleCode);
    const [submitted, setSubmitted] = useState(false);

    return (
      <div>
        <SyntaxHighlightingEditor
          value={value}
          onChange={v => {
            setValue(v);
            setSubmitted(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setSubmitted(true);
            }
          }}
          style={{ width: '500px', height: '300px' }}
        />
        {submitted && (
          <div style={{ marginTop: '10px', color: 'green' }}>
            Submitted! (Press Cmd/Ctrl+Enter to submit)
          </div>
        )}
      </div>
    );
  }
};

export const Uncontrolled: Story = {
  args: {
    defaultValue: sampleCode
  },
  render: () => {
    const [changeCount, setChangeCount] = useState(0);

    return (
      <div>
        <SyntaxHighlightingEditor
          defaultValue={sampleCode}
          onChange={() => setChangeCount(c => c + 1)}
          style={{ width: '500px', height: '300px' }}
        />
        <div style={{ marginTop: '10px' }}>Changes: {changeCount}</div>
      </div>
    );
  }
};
