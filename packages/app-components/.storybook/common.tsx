import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';

export const themeDecorator = () => {
  // @ts-ignore
  return Story => (
    <div style={{ fontSize: '11px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div
          className={'dark-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--primary-bg)',
            color: 'var(--primary-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'dark-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--secondary-bg)',
            color: 'var(--secondary-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--primary-bg)',
            color: 'var(--primary-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--secondary-bg)',
            color: 'var(--secondary-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
      </div>
    </div>
  );
};
