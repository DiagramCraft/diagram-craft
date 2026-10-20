import type { RelationVersion } from '@arch-register/api-types/relationVersionContract';

type Kind = RelationVersion['kind'];

// Mirrors the server's assertVersionCanBeRestored for relations.
const RESTORABLE_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  'autosave',
  'saved_version',
  'case_applied'
]);

export const isRestorableRelationVersionKind = (kind: Kind): boolean => RESTORABLE_KINDS.has(kind);

export const relationVersionTypeLabel = (kind: Kind): string =>
  kind === 'saved_version' ? 'saved' : kind === 'case_applied' ? 'applied' : 'autosave';
