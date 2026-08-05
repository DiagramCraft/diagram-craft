import type { AuthorizationContext } from '@arch-register/permissions';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import {
  isFieldEditRestricted,
  isFieldViewRestricted,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import type { AutomationRuleDbResult } from './db/automationRuleDatabase';
import {
  isAutomationReadFieldKnown,
  isAutomationWriteFieldKnown
} from './automationRuleFieldAccess';

/**
 * Checks every rule field reference against the owner's current field-group access. This is kept
 * separate from rule CRUD validation because saved rules must be checked again when they match and
 * immediately before their asynchronous actions execute.
 */
export const isAutomationRuleAuthorized = (
  authCtx: AuthorizationContext,
  schema: SchemaDbResult | FieldGroupSchemaShape | null,
  rule: Pick<AutomationRuleDbResult, 'resource_type' | 'trigger' | 'conditions' | 'actions'>
): boolean => {
  if (!schema) return false;

  if (
    (rule.trigger.kind === 'field_changed' || rule.trigger.kind === 'relation_field_changed') &&
    (!isAutomationReadFieldKnown(rule.resource_type, schema, rule.trigger.field) ||
      isFieldViewRestricted(authCtx, schema, rule.trigger.field))
  ) {
    return false;
  }

  if (
    rule.conditions.some(
      condition =>
        !isAutomationReadFieldKnown(rule.resource_type, schema, condition.field) ||
        isFieldViewRestricted(authCtx, schema, condition.field)
    )
  ) {
    return false;
  }

  return rule.actions.every(action => {
    if (action.kind === 'set_field_value') {
      return (
        isAutomationWriteFieldKnown(schema, action.field) &&
        !isFieldEditRestricted(authCtx, schema, action.field)
      );
    }
    return (
      action.kind !== 'send_notification' ||
      action.recipient.kind !== 'reference_owner' ||
      (isAutomationReadFieldKnown(rule.resource_type, schema, action.recipient.field) &&
        !isFieldViewRestricted(authCtx, schema, action.recipient.field))
    );
  });
};
