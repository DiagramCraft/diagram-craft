import { PortalContextProvider } from '@diagram-craft/app-components/PortalContext';

export const themeDecorator = () => {
  // @ts-ignore
  return Story => (
    <div style={{ fontSize: '11px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div
          className={'dark-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--primary-bg)' }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'dark-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--secondary-bg)' }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--primary-bg)' }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--secondary-bg)' }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
      </div>
    </div>
  );
};
