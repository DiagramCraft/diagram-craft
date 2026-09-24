import { describe, expect, it } from 'vitest';
import { buildControlTraceMatrix } from './useControlTraceMatrix';

const riskControlRelation = (controlId: string, riskId: string) => ({
  _in: { id: riskId },
  _out: { id: controlId }
});

const controlAffectsRelation = (controlId: string, assetId: string) => ({
  _in: { id: controlId },
  _out: { id: assetId }
});

describe('buildControlTraceMatrix', () => {
  it('builds control<->risk and control<->asset membership in both directions', () => {
    const matrix = buildControlTraceMatrix(
      [
        riskControlRelation('control-1', 'risk-1'),
        riskControlRelation('control-1', 'risk-2'),
        riskControlRelation('control-2', 'risk-1')
      ],
      [controlAffectsRelation('control-1', 'asset-1')]
    );

    expect(matrix.riskIdsByControlId.get('control-1')).toEqual(new Set(['risk-1', 'risk-2']));
    expect(matrix.riskIdsByControlId.get('control-2')).toEqual(new Set(['risk-1']));
    expect(matrix.controlIdsByRiskId.get('risk-1')).toEqual(new Set(['control-1', 'control-2']));
    expect(matrix.controlIdsByRiskId.get('risk-2')).toEqual(new Set(['control-1']));
    expect(matrix.assetIdsByControlId.get('control-1')).toEqual(new Set(['asset-1']));
    expect(matrix.controlIdsByAssetId.get('asset-1')).toEqual(new Set(['control-1']));
    expect(matrix.controlIdsByAssetId.has('asset-2')).toBe(false);
  });

  it('returns empty maps for no relations', () => {
    const matrix = buildControlTraceMatrix([], []);
    expect(matrix.riskIdsByControlId.size).toBe(0);
    expect(matrix.controlIdsByAssetId.size).toBe(0);
  });
});
