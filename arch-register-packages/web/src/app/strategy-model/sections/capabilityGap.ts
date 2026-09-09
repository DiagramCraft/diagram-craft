/**
 * Shared Gap-column formatting for the Strategy & Capability Modelling tables (Capabilities list
 * and the Strategy section's "Capabilities this objective depends on" table). Mirrors the design
 * reference's Gap column (`BCMCapabilityList` / `BCMStrategy`, `bcm-views.jsx`): "on target" or
 * ahead of target (gap <= 0) reads as a plain dash rather than a signed number, and only a real
 * gap gets the "+X.X" treatment, colored by how large it is.
 */
export const formatGap = (
  gap: number | null
): { text: string; className?: string; style?: { color: string } } => {
  if (gap == null || gap <= 0) return { text: '—', className: 'dim' };
  // `--error-fg`/`--warning-fg` are the real severity tokens (`packages/main/src/tokens.css`) —
  // there's no dedicated "danger"/"success" token in this app, unlike the design reference.
  if (gap >= 1.5)
    return { text: `+${gap.toFixed(1)}`, style: { color: 'var(--error-fg, #e05252)' } };
  if (gap >= 0.5) return { text: `+${gap.toFixed(1)}`, style: { color: 'var(--warning-fg)' } };
  return { text: `+${gap.toFixed(1)}` };
};
