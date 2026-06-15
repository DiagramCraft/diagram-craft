import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorPicker } from './ColorPicker';
import { useState } from 'react';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';

const meta = {
  title: 'Components/ColorPicker',
  component: ColorPicker,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean'
    },
    size: {
      control: 'select',
      options: ['default', 'small']
    }
  }
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: SCHEMA_COLORS[0],
    onChange: (color: string | null) => console.log('Selected color:', color)
  }
};

export const NoSelection: Story = {
  args: {
    value: null,
    onChange: (color) => console.log('Selected color:', color)
  }
};

export const SmallSize: Story = {
  args: {
    value: SCHEMA_COLORS[2],
    onChange: (color) => console.log('Selected color:', color),
    size: 'small'
  }
};

export const Disabled: Story = {
  args: {
    value: SCHEMA_COLORS[1],
    onChange: (color) => console.log('Selected color:', color),
    disabled: true
  }
};


export const MultipleInstances = {
  render: () => {
    const [color1, setColor1] = useState<string | null>(SCHEMA_COLORS[0] ?? null);
    const [color2, setColor2] = useState<string | null>(SCHEMA_COLORS[4] ?? null);
    const [color3, setColor3] = useState<string | null>(null);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Primary Color
          </div>
          <ColorPicker value={color1} onChange={setColor1} />
          <div style={{ fontSize: '11px', marginTop: '0.25rem', color: '#666' }}>
            {color1 ?? 'No color selected'}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Secondary Color
          </div>
          <ColorPicker value={color2} onChange={setColor2} />
          <div style={{ fontSize: '11px', marginTop: '0.25rem', color: '#666' }}>
            {color2 ?? 'No color selected'}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Accent Color
          </div>
          <ColorPicker value={color3} onChange={setColor3} />
          <div style={{ fontSize: '11px', marginTop: '0.25rem', color: '#666' }}>
            {color3 ?? 'No color selected'}
          </div>
        </div>
      </div>
    );
  }
};

export const AllColors = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '14px', fontWeight: 500 }}>
        Available Colors ({SCHEMA_COLORS.length})
      </div>
      <ColorPicker value={null} onChange={() => {}} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
        {SCHEMA_COLORS.map((color) => (
          <div
            key={color}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem',
              border: '1px solid #e5e7eb',
              borderRadius: '4px'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: color,
                border: '1px solid #e5e7eb',
                flexShrink: 0
              }}
            />
            <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{color}</code>
          </div>
        ))}
      </div>
    </div>
  )
};

export const SizeComparison = {
  render: () => {
    const [defaultColor, setDefaultColor] = useState<string | null>(SCHEMA_COLORS[2] ?? null);
    const [smallColor, setSmallColor] = useState<string | null>(SCHEMA_COLORS[5] ?? null);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Default Size
          </div>
          <ColorPicker value={defaultColor} onChange={setDefaultColor} />
        </div>
        
        <div>
          <div style={{ fontSize: '12px', marginBottom: '0.5rem', fontWeight: 500 }}>
            Small Size
          </div>
          <ColorPicker value={smallColor} onChange={setSmallColor} size="small" />
        </div>
      </div>
    );
  }
};
