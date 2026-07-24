import { getSystemUserId } from '../auth/systemUsers';

// Writes made by AI metadata generators are attributed to this actor instead of
// the human who scheduled the run. See domain/auth/systemUsers.ts for the registry.
export const AI_SYSTEM_USER_ID = getSystemUserId('ai-metadata-generator');

export const METADATA_GENERATION_DEBOUNCE_MS = 1 * 60 * 1000;
export const METADATA_GENERATION_RETRY_DELAY_MS = 60 * 1000;
export const METADATA_GENERATION_MAX_ATTEMPTS = 2;
export const METADATA_GENERATION_SCAN_INTERVAL_MINUTES = 2;

export const METADATA_GENERATION_SCAN_JOB_TYPE = 'document.generate-metadata.scan';
export const METADATA_GENERATION_SCAN_SYSTEM_IDENTITY = 'document-metadata-generator';
