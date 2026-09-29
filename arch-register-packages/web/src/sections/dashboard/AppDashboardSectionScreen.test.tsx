import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { AppDashboardSectionScreen } from './AppDashboardSectionScreen';

vi.mock('./AppDashboardScreen', () => ({
  AppDashboardScreen: (props: { appKey: string }) => (
    <div data-testid="dashboard">dashboard:{props.appKey}</div>
  )
}));

describe('AppDashboardSectionScreen', () => {
  test('renders the loading message while loading', () => {
    const html = renderToStaticMarkup(
      <AppDashboardSectionScreen
        appKey="some-app"
        isLoading={true}
        isEnabled={false}
        loadingMessage="Loading…"
        notEnabledMessage="Not enabled"
      />
    );
    expect(html).toContain('Loading…');
    expect(html).not.toContain('dashboard:');
  });

  test('renders the not-enabled message when not loading and not enabled', () => {
    const html = renderToStaticMarkup(
      <AppDashboardSectionScreen
        appKey="some-app"
        isLoading={false}
        isEnabled={false}
        loadingMessage="Loading…"
        notEnabledMessage="Not enabled"
      />
    );
    expect(html).toContain('Not enabled');
    expect(html).not.toContain('dashboard:');
  });

  test('renders the dashboard for the given appKey once loaded and enabled', () => {
    const html = renderToStaticMarkup(
      <AppDashboardSectionScreen
        appKey="some-app"
        isLoading={false}
        isEnabled={true}
        loadingMessage="Loading…"
        notEnabledMessage="Not enabled"
      />
    );
    expect(html).toContain('dashboard:some-app');
  });
});
