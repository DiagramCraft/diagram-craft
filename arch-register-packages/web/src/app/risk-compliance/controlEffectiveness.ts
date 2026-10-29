import { toneColor, type ToneOrNeutral } from '../../components/bandColor';

/**
 * Colour for `Control.operating_effectiveness`'s fixed `control-effectiveness` enum values (see
 * `schemaTemplates.ts`'s `risk-compliance` template) — mirrors the design reference's
 * `RC_EFF_TONE` (`rc-data.jsx`). Used to colour the Controls quick-jump dot in
 * `RiskComplianceSidebar.tsx`, replacing an earlier per-Control "coverage" score that combined a
 * control's coverage/effectiveness values across its *different* mitigated risks via the same
 * "probability at least one layer catches it" formula the Risks screen uses for combining
 * multiple controls over *one* risk — a reuse that doesn't hold up the other way round (it grows
 * with unrelated risk count rather than reflecting how effective the control actually is), so
 * effectiveness itself — the field this already measures — is the honest thing to colour by.
 * Colors come from `../../components/bandColor.ts`'s good/neutral/warn/bad scheme.
 */
type ControlEffectiveness = 'effective' | 'partially-effective' | 'ineffective' | 'not-tested';

export const CONTROL_EFFECTIVENESS_TONE: Record<ControlEffectiveness, ToneOrNeutral> = {
  effective: 'good',
  'partially-effective': 'warn',
  ineffective: 'bad',
  'not-tested': 'neutral'
};

export const CONTROL_EFFECTIVENESS_COLOR: Record<string, string> = {
  effective: toneColor(CONTROL_EFFECTIVENESS_TONE.effective),
  'partially-effective': toneColor(CONTROL_EFFECTIVENESS_TONE['partially-effective']),
  ineffective: toneColor(CONTROL_EFFECTIVENESS_TONE.ineffective),
  'not-tested': toneColor(CONTROL_EFFECTIVENESS_TONE['not-tested'])
};
