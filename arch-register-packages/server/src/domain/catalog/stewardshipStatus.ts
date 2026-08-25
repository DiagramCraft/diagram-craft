import type { AuthorizationContext } from '@arch-register/permissions';
import type { Entity, SchemaDbResult } from './db/catalogDatabase';
import { restrictedFieldIds } from '../auth/fieldGroupAccessControl';
import { parseIsoDate } from '../../utils/retentionDate';

export type ReviewStatus = 'active' | 'approaching' | 'overdue' | 'incomplete';

const REVIEW_APPROACHING_WINDOW_DAYS = 30;

/**
 * Buckets a review date's freshness relative to `now`, using the same days-until-target windowing
 * as retention's expiry status (see `retentionStatus.ts`). Unlike retention, there is no
 * "expiry date" to report back — only the bucket.
 */
export const computeReviewStatus = (
  reviewDate: string | null | undefined,
  now: Date
): ReviewStatus => {
  const parsed = parseIsoDate(reviewDate);
  if (!parsed) return 'incomplete';

  const daysUntilReview = Math.floor((parsed.getTime() - now.getTime()) / 86_400_000);
  if (daysUntilReview < 0) return 'overdue';
  if (daysUntilReview <= REVIEW_APPROACHING_WINDOW_DAYS) return 'approaching';
  return 'active';
};

// The stewardship field group ships with these stable field ids (see `schemaTemplates.ts`'s
// `informationAssetFieldGroup` and the seed data's `Data Entity` schema) — schemas that never
// included the group simply don't have these ids, which is what makes them "not applicable"
// rather than "missing" below.
const REVIEW_DATE_FIELD_ID = 'review_date';
const STEWARDSHIP_FIELD_IDS = ['steward', 'custodian'] as const;

// Only the fields actually read below are required, mirroring `computeEntityCompleteness`'s
// minimal `CompletenessInput` shape.
type StewardshipInput = Pick<Entity, 'owner' | 'data'>;

const isNonEmpty = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

export type StewardshipCompleteness = {
  /** True when the schema doesn't have any stewardship-relevant fields at all. */
  notApplicable: boolean;
  missingOwner: boolean;
  missingFieldIds: string[];
};

/**
 * Reports which of owner/steward/custodian/review-date are missing for an entity, honoring
 * field-group redaction and the required-or-expected-only rule `computeEntityCompleteness` also
 * follows, so a restricted field's occupancy can't leak through this status and an `optional`
 * field left empty is never reported as "missing". `authCtx` defaults to `null` (unfiltered) for
 * write-time/system callers, matching `computeEntityCompleteness`.
 */
export const computeStewardshipCompleteness = (
  entity: StewardshipInput,
  schema: SchemaDbResult,
  authCtx: AuthorizationContext | null = null
): StewardshipCompleteness => {
  const restricted = restrictedFieldIds(authCtx, schema);
  const applicableFields = schema.fields.filter(
    field =>
      STEWARDSHIP_FIELD_IDS.includes(field.id as (typeof STEWARDSHIP_FIELD_IDS)[number]) &&
      (field.requirementLevel === 'required' || field.requirementLevel === 'expected') &&
      !restricted.has(field.id)
  );

  const missingFieldIds = applicableFields
    .filter(field => !isNonEmpty(entity.data[field.id]))
    .map(field => field.id);

  return {
    notApplicable: applicableFields.length === 0,
    missingOwner: !entity.owner,
    missingFieldIds
  };
};

export type EntityGovernanceStatus = {
  reviewStatus: ReviewStatus;
  stewardship: StewardshipCompleteness;
};

/**
 * Computes both the review-date bucket and stewardship completeness for an entity. Returns
 * `reviewStatus: 'incomplete'` and `stewardship.notApplicable: true` for schemas that never
 * opted into the stewardship field group, since there's nothing to review or be missing.
 */
export const computeEntityGovernanceStatus = (
  entity: StewardshipInput,
  schema: SchemaDbResult,
  now: Date,
  authCtx: AuthorizationContext | null = null
): EntityGovernanceStatus => {
  const restricted = restrictedFieldIds(authCtx, schema);
  const reviewDateField = schema.fields.find(field => field.id === REVIEW_DATE_FIELD_ID);
  const reviewDate =
    reviewDateField && !restricted.has(reviewDateField.id)
      ? (entity.data[REVIEW_DATE_FIELD_ID] as string | null | undefined)
      : undefined;

  return {
    reviewStatus: reviewDateField ? computeReviewStatus(reviewDate, now) : 'incomplete',
    stewardship: computeStewardshipCompleteness(entity, schema, authCtx)
  };
};
