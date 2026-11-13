/**
 * Error input for a stale draft revision. Every draft mutation (stage, unstage, discard, publish)
 * uses it, so clients can rely on `data.code === 'REVISION_CONFLICT'`.
 */
export const revisionConflictError = () => ({
  status: 409,
  message: 'The schema draft was changed by someone else; reload it and try again',
  data: { code: 'REVISION_CONFLICT' }
});
