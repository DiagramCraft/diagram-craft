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
 */
export const CONTROL_EFFECTIVENESS_COLOR: Record<string, string> = {
  effective: 'var(--cmp-fg-success, #22c55e)',
  'partially-effective': 'var(--cmp-fg-warning, #eab308)',
  ineffective: 'var(--cmp-fg-danger, #ef4444)',
  'not-tested': 'var(--cmp-fg-dim, #9ca3af)'
};
