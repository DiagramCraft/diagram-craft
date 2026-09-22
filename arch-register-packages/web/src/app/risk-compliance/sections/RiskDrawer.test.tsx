import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RiskDrawer } from './RiskDrawer';

const mocks = vi.hoisted(() => ({
  drawerProps: undefined as
    | {
        entityId: string;
        entityLabel?: string;
        formatDateValue?: (value: unknown) => string;
      }
    | undefined
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.drawerProps) => {
    mocks.drawerProps = props;
    return <div>shared entity drawer</div>;
  }
}));

describe('RiskDrawer', () => {
  it('delegates entity rendering and passes the risk entity label', () => {
    const markup = renderToStaticMarkup(
      <RiskDrawer workspaceSlug="workspace-1" riskId="risk-1" onClose={vi.fn()} />
    );

    expect(markup).toContain('shared entity drawer');
    expect(mocks.drawerProps?.entityId).toBe('risk-1');
    expect(mocks.drawerProps?.entityLabel).toBe('risk');
    expect(mocks.drawerProps?.formatDateValue?.('2026-06-01')).toBe('2026-06-01');
  });
});
