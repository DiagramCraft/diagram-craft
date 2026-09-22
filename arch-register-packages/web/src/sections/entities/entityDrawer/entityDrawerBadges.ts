import {
  residualRiskBand,
  RESIDUAL_RISK_BAND_COLOR
} from '../../../app/risk-compliance/residualRiskBand';
import {
  renewalWindow,
  RENEWAL_WINDOWS,
  RENEWAL_WINDOW_COLOR
} from '../../../app/vendor-management/contractRenewalWindow';
import {
  createEntityDrawerBadgeRegistry,
  type EntityDrawerBadgeDefinition
} from './EntityDrawerBadgeRegistry';

const RENEWAL_WINDOW_LABEL = new Map(RENEWAL_WINDOWS.map(window => [window.id, window.label]));

const definitions: readonly EntityDrawerBadgeDefinition[] = [
  {
    badgeId: 'risk.residualBand',
    resolve: entity => {
      const score =
        typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null;
      const band = residualRiskBand(score);
      return band ? { label: band, color: RESIDUAL_RISK_BAND_COLOR[band] } : null;
    }
  },
  {
    badgeId: 'contract.renewalWindow',
    resolve: entity => {
      const window = renewalWindow(
        typeof entity.contract_end === 'string' ? entity.contract_end : null
      );
      return { label: RENEWAL_WINDOW_LABEL.get(window), color: RENEWAL_WINDOW_COLOR[window] };
    }
  }
];

export const entityDrawerBadgeRegistry = createEntityDrawerBadgeRegistry(definitions);
