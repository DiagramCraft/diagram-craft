// Reserved user row seeded by migration 055_add_system_actor_user; writes made by AI metadata
// generators are attributed to this actor instead of the human who scheduled the run.
export const AI_SYSTEM_USER_ID = '00000000-0000-0000-0000-0000000000a1';

export const METADATA_GENERATION_DEBOUNCE_MS = 10 * 60 * 1000;
export const METADATA_GENERATION_RETRY_DELAY_MS = 60 * 1000;
export const METADATA_GENERATION_MAX_ATTEMPTS = 2;
export const METADATA_GENERATION_SCAN_INTERVAL_MINUTES = 5;

export const METADATA_GENERATION_SCAN_JOB_TYPE = 'document.generate-metadata.scan';
export const METADATA_GENERATION_SCAN_SYSTEM_IDENTITY = 'document-metadata-generator';
