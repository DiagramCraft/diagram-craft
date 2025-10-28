import type { ParsedElement, ParseErrors } from './parser';
import { collectElementIds } from './utils';

/**
 * Validation rule that checks the parsed elements and returns errors keyed by line number.
 * Returns a Map where keys are line numbers and values are error messages.
 */
type ValidationRule = (elements: ParsedElement[]) => ParseErrors;

/**
 * Validation rule: Check that all element IDs are unique
 */
const validateUniqueIds: ValidationRule = (elements: ParsedElement[]): ParseErrors => {
  const errors = new Map<number, string>();
  const idMap = collectElementIds(elements);

  // Check for duplicates
  for (const [id, lines] of idMap.entries()) {
    if (lines.length > 1) {
      // Add error to all lines where the duplicate ID appears
      for (const line of lines) {
        errors.set(line, `Duplicate element ID: "${id}"`);
      }
    }
  }

  return errors;
};

/**
 * All validation rules to run on the parsed elements
 */
export const VALIDATION_RULES: ValidationRule[] = [validateUniqueIds];
