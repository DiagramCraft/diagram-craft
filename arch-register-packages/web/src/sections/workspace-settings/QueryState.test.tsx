import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryState } from './QueryState';

const render = (props: Partial<Parameters<typeof QueryState>[0]>) =>
  renderToStaticMarkup(
    <QueryState isLoading={false} subject="things" empty={{ title: 'Nothing' }} {...props}>
      <span>content</span>
    </QueryState>
  );

describe('QueryState', () => {
  it('shows error first', () => {
    expect(render({ error: new Error('x'), isLoading: true })).toContain('Failed to load things.');
  });
  it('shows loading', () => {
    expect(render({ isLoading: true })).toContain('Loading things…');
  });
  it('shows empty', () => {
    expect(render({ isEmpty: true })).toContain('Nothing');
  });
  it('shows content', () => {
    expect(render({})).toContain('content');
  });
});
