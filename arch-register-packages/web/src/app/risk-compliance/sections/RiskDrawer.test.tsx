import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { RiskDrawer } from './RiskDrawer';

const mocks = vi.hoisted(() => ({
  drawerProps: undefined as
    | {
        entityId: string;
        loadingMessage?: unknown;
        unavailableMessage?: unknown;
        formatDateValue?: (value: unknown) => string;
        additionalBadges?: (entity: EntityRecord) => unknown;
      }
    | undefined
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: (props: typeof mocks.drawerProps) => {
    mocks.drawerProps = props;
    return <div>shared entity drawer</div>;
  }
}));

const entity = (residual_risk_score: unknown) =>
  ({
    _uid: 'risk-1',
    _publicId: 'RSK-001',
    _name: 'Customer Account Takeover',
    _schema: { id: 'risk', name: 'Risk' },
    residual_risk_score
  }) as unknown as EntityRecord;

describe('RiskDrawer', () => {
  it('delegates entity rendering and preserves risk loading state messages', () => {
    const markup = renderToStaticMarkup(
      <RiskDrawer workspaceSlug="workspace-1" riskId="risk-1" onClose={vi.fn()} />
    );

    expect(markup).toContain('shared entity drawer');
    expect(mocks.drawerProps?.entityId).toBe('risk-1');
    expect(mocks.drawerProps?.loadingMessage).toBe('Loading risk…');
    expect(mocks.drawerProps?.unavailableMessage).toBe('This risk is unavailable.');
    expect(mocks.drawerProps?.formatDateValue?.('2026-06-01')).toBe('2026-06-01');
  });

  it('adds the residual-risk band from the loaded entity score', () => {
    renderToStaticMarkup(
      <RiskDrawer workspaceSlug="workspace-1" riskId="risk-1" onClose={vi.fn()} />
    );

    const badge = mocks.drawerProps?.additionalBadges?.(entity(9));
    expect(renderToStaticMarkup(badge as React.ReactElement)).toContain('medium');
    expect(mocks.drawerProps?.additionalBadges?.(entity(null))).toBeNull();
  });
});
