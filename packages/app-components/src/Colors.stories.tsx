import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Foundations/Colors',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

type Surface = { name: string; bg: string; fgs: string[] };

const SURFACES: Surface[] = [
  {
    name: 'base',
    bg: '--base-bg',
    fgs: ['--base-fg', '--base-fg-secondary', '--base-fg-tertiary', '--base-fg-dimmed']
  },
  {
    name: 'panel',
    bg: '--panel-bg',
    fgs: ['--panel-fg', '--panel-fg-secondary', '--panel-fg-tertiary', '--panel-fg-dimmed']
  },
  {
    name: 'cmp',
    bg: '--cmp-bg',
    fgs: [
      '--cmp-fg',
      '--cmp-fg-secondary',
      '--cmp-fg-tertiary',
      '--cmp-fg-disabled',
      '--cmp-fg-dimmed'
    ]
  },
  {
    name: 'cmp-hover',
    bg: '--cmp-bg-hover',
    fgs: [
      '--cmp-fg',
      '--cmp-fg-secondary',
      '--cmp-fg-tertiary',
      '--cmp-fg-disabled',
      '--cmp-fg-dimmed'
    ]
  },
  {
    name: 'accent',
    bg: '--accent-bg',
    fgs: ['--accent-fg', '--accent-fg-dimmed', '--accent-fg-hover']
  },
  {
    name: 'accent-selected',
    bg: '--accent-bg-selected',
    fgs: ['--accent-fg', '--accent-fg-dimmed', '--accent-fg-hover']
  }
];

const SurfaceSample = (props: { surface: Surface }) => (
  <div
    style={{
      backgroundColor: `var(${props.surface.bg})`,
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      flex: 1,
      minWidth: 200
    }}
  >
    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'gray' }}>
      {props.surface.bg}
    </div>
    {props.surface.fgs.map(fg => (
      <div key={fg} style={{ color: `var(${fg})`, fontSize: '13px' }}>
        <span style={{ fontFamily: 'monospace' }}>{fg}</span>
        <div>The quick brown fox jumps over the lazy dog</div>
      </div>
    ))}
  </div>
);

const ThemeColumn = (props: { theme: 'dark-theme' | 'light-theme' }) => (
  <div className={props.theme} style={{ flex: 1, minWidth: 0 }}>
    <div
      style={{
        padding: '0.5rem 1rem',
        fontWeight: 'bold',
        backgroundColor: 'var(--panel-bg)',
        color: 'var(--panel-fg)'
      }}
    >
      {props.theme === 'dark-theme' ? 'Dark' : 'Light'}
    </div>
    {SURFACES.map(s => (
      <SurfaceSample key={s.name} surface={s} />
    ))}
  </div>
);

export const TextOnSurfaces: Story = {
  render: () => (
    <div style={{ display: 'flex' }}>
      <ThemeColumn theme="dark-theme" />
      <ThemeColumn theme="light-theme" />
    </div>
  )
};

export const PerSurface: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {SURFACES.map(s => (
        <div key={s.name} style={{ display: 'flex' }}>
          <div className="dark-theme" style={{ flex: 1, display: 'flex' }}>
            <SurfaceSample surface={s} />
          </div>
          <div className="light-theme" style={{ flex: 1, display: 'flex' }}>
            <SurfaceSample surface={s} />
          </div>
        </div>
      ))}
    </div>
  )
};
