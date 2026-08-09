import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useEntitiesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntities: (...args: unknown[]) => useEntitiesMock(...args)
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'workspace-1' })
}));

const { TopEntitiesWidget } = await import('./TopEntitiesWidget');

describe('TopEntitiesWidget', () => {
  it('ranks entities by the configured field, highest first, limited to N', () => {
    useEntitiesMock.mockReturnValue({
      data: [
        { _uid: '1', _publicId: 'RISK-1', _name: 'Low risk', residual_risk_score: 4 },
        { _uid: '2', _publicId: 'RISK-2', _name: 'High risk', residual_risk_score: 20 },
        { _uid: '3', _publicId: 'RISK-3', _name: 'Mid risk', residual_risk_score: 10 }
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(
      <TopEntitiesWidget
        config={{ schema: 'risk', fieldId: 'residual_risk_score', direction: 'desc', limit: 2 }}
      />
    );

    const highIdx = html.indexOf('High risk');
    const midIdx = html.indexOf('Mid risk');
    expect(highIdx).toBeGreaterThan(-1);
    expect(midIdx).toBeGreaterThan(highIdx);
    expect(html).not.toContain('Low risk');
  });

  it('sorts ascending when configured', () => {
    useEntitiesMock.mockReturnValue({
      data: [
        { _uid: '1', _publicId: 'RISK-1', _name: 'Low risk', residual_risk_score: 4 },
        { _uid: '2', _publicId: 'RISK-2', _name: 'High risk', residual_risk_score: 20 }
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(
      <TopEntitiesWidget
        config={{ schema: 'risk', fieldId: 'residual_risk_score', direction: 'asc', limit: 5 }}
      />
    );

    expect(html.indexOf('Low risk')).toBeLessThan(html.indexOf('High risk'));
  });

  it('shows an unconfigured message when no field is chosen', () => {
    const html = renderToStaticMarkup(
      <TopEntitiesWidget config={{ schema: 'risk', fieldId: '', direction: 'desc', limit: 5 }} />
    );

    expect(html).toContain('not fully configured');
  });
});
