/**
 * Shared addressing convention for `case_subkind` (on both `governance_case` and
 * `workspace_governance_case_config`, see #2818/#2819): a stable UUID-based address instead of a
 * name string, so schema/field renames don't break the config association. `rootId` is a schema
 * UUID (entity/relation schemas) or document-type UUID; `fieldId` further scopes to a single field
 * within that root, when applicable.
 */
const SUBKIND_SEPARATOR = ':';

export const encodeCaseSubkind = (rootId: string, fieldId?: string): string =>
  fieldId ? `${rootId}${SUBKIND_SEPARATOR}${fieldId}` : rootId;

/**
 * True when `subkind` is `rootId` itself, or scoped to any field under it (`rootId:fieldId`).
 * Used to find every config row that needs cleanup when a schema/document type is deleted.
 */
export const caseSubkindMatchesRootOrDescendant = (subkind: string, rootId: string): boolean =>
  subkind === rootId || subkind.startsWith(`${rootId}${SUBKIND_SEPARATOR}`);
