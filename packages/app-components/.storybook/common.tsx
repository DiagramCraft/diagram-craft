export const themeDecorator = () => {
  // @ts-ignore
  return Story => (
    <div style={{ fontSize: '11px' }}>
      <div style={{ display: 'flex' }}>
        <div
          className={'dark-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--primary-bg)' }}
        >
          <Story />
        </div>
        <div
          className={'light-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--primary-bg)' }}
        >
          <Story />
        </div>
      </div>
      <div style={{ display: 'flex' }}>
        <div
          className={'dark-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--secondary-bg)' }}
        >
          <Story />
        </div>
        <div
          className={'light-theme'}
          style={{ padding: '2rem', backgroundColor: 'var(--secondary-bg)' }}
        >
          <Story />
        </div>
      </div>
    </div>
  );
};
