export type ViolationLike = {
  entity_id: string;
  entity_name: string | null;
  severity: 'error' | 'warning';
  message: string;
  check_id: string;
};

export type ViolatingEntity = {
  entityId: string;
  entityName: string;
  worstSeverity: 'error' | 'warning';
  messages: string[];
};

/**
 * Groups violations by entity, errors first, then by number of violations (most gaps first), then
 * by name. Optionally restricted to a set of check ids.
 */
export const groupViolationsByEntity = (
  violations: readonly ViolationLike[],
  options: { checkIds?: ReadonlySet<string>; limit: number }
): { entities: ViolatingEntity[]; total: number } => {
  const byEntity = new Map<string, ViolatingEntity>();
  for (const violation of violations) {
    if (options.checkIds && !options.checkIds.has(violation.check_id)) continue;
    const existing = byEntity.get(violation.entity_id);
    if (existing) {
      existing.messages.push(violation.message);
      if (violation.severity === 'error') existing.worstSeverity = 'error';
    } else {
      byEntity.set(violation.entity_id, {
        entityId: violation.entity_id,
        entityName: violation.entity_name ?? violation.entity_id,
        worstSeverity: violation.severity,
        messages: [violation.message]
      });
    }
  }
  const sorted = [...byEntity.values()].sort(
    (a, b) =>
      Number(b.worstSeverity === 'error') - Number(a.worstSeverity === 'error') ||
      b.messages.length - a.messages.length ||
      a.entityName.localeCompare(b.entityName)
  );
  return { entities: sorted.slice(0, options.limit), total: sorted.length };
};
