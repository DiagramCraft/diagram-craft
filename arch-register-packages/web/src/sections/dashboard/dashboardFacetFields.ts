import type { SchemaField } from '@arch-register/api-types/schemaContract';

/** How a `facets` sidebar section tallies and labels its values. */
export type FacetFieldKind = 'reference' | 'select' | 'text';

/** The facet kind a schema field supports, or `undefined` when it cannot be faceted. */
export const facetKindForField = (field: SchemaField): FacetFieldKind | undefined => {
  if (field.type === 'reference') return 'reference';
  if (field.type === 'select') return 'select';
  if (field.type === 'text') return 'text';
  if (field.type === 'derived') {
    if (field.resultType === 'select') return 'select';
    if (field.resultType === 'text') return 'text';
  }
  return undefined;
};
