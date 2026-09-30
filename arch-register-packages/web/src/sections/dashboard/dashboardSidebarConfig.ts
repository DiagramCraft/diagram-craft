import type { DashboardFacetConfig } from '@arch-register/api-types/dashboardContract';

export const isValidVariableName = (value: string) => /^[a-zA-Z_]\w*$/.test(value);

export const moveItem = <T>(items: readonly T[], index: number, delta: -1 | 1): T[] => {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const result = [...items];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
};

export const isFacetsConfigValid = (
  schemaName: string,
  facets: readonly DashboardFacetConfig[]
): boolean => {
  if (schemaName.trim() === '' || facets.length === 0) return false;
  const names = facets.map(facet => facet.variableName.trim());
  return (
    facets.every(facet => facet.fieldId !== '' && isValidVariableName(facet.variableName.trim())) &&
    new Set(names).size === names.length
  );
};

export const normalizeFacets = (facets: readonly DashboardFacetConfig[]): DashboardFacetConfig[] =>
  facets.map(facet => ({
    fieldId: facet.fieldId,
    variableName: facet.variableName.trim(),
    itemLabel: facet.itemLabel?.trim() || undefined
  }));
