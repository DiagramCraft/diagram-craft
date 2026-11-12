/** One-line description of the field changes recorded for a schema or document type version. */
export const summarizeFieldChanges = (changeSummary: Record<string, unknown>): string => {
  const parts: string[] = [];
  const added = changeSummary.added as string[] | undefined;
  const removed = changeSummary.removed as string[] | undefined;
  const renamed = changeSummary.renamed as Array<{ from: string; to: string }> | undefined;
  const archived = changeSummary.archived as string[] | undefined;

  if (added?.length) parts.push(`Added ${added.join(', ')}`);
  if (removed?.length) parts.push(`Removed ${removed.join(', ')}`);
  if (renamed?.length) {
    parts.push(`Renamed ${renamed.map(r => `${r.from} → ${r.to}`).join(', ')}`);
  }
  if (archived?.length) parts.push(`Archived ${archived.join(', ')}`);

  return parts.length > 0 ? parts.join(' · ') : 'No field changes';
};
