# Implementation Plan: Fix Prototype Pollution in Entity Filter SQL Column Lookup

**Issue:** #2058 - Guard entity filter SQL column lookup against inherited properties

## Problem Summary

The `listEntitiesPaginated` method in both PostgreSQL and SQLite catalog implementations is vulnerable to prototype pollution. When looking up SQL column expressions using `ENTITY_BUILTIN_COLUMNS[cond.fieldId]`, inherited properties from `Object.prototype` (like `toString`, `constructor`, `__proto__`) can be accessed instead of falling through to the `isValidFieldId` validation.

### Security Impact
- **Severity:** Medium (Availability/Input Handling Bug)
- **Type:** Prototype pollution leading to malformed SQL
- **Risk:** Request-level 500 errors for schema-valid filter input
- **SQL Injection Risk:** Low - attacker can only select fixed inherited properties, not control SQL text

### Affected Code Locations
1. `arch-register-packages/server/src/domain/catalog/db/postgresCatalog.ts` (line 196)
2. `arch-register-packages/server/src/domain/catalog/db/sqliteCatalog.ts` (line 193)
3. `arch-register-packages/server/src/domain/catalog/db/filterBuilder.ts` (ENTITY_BUILTIN_COLUMNS definition)

## Solution Design

### Approach: Use `Object.hasOwn()` Guard

Replace the current lookup pattern:
```typescript
const col = ENTITY_BUILTIN_COLUMNS[cond.fieldId] ?? ...
```

With a guarded lookup:
```typescript
const col = Object.hasOwn(ENTITY_BUILTIN_COLUMNS, cond.fieldId)
  ? ENTITY_BUILTIN_COLUMNS[cond.fieldId]
  : (isValidFieldId(cond.fieldId) ? `(e.data->>'${cond.fieldId}')` : null);
```

### Why This Approach?

1. **Minimal Change:** Only requires modifying the lookup logic in two files
2. **Clear Intent:** `Object.hasOwn()` explicitly checks for own properties
3. **No Breaking Changes:** Maintains existing API and behavior for valid inputs
4. **Performance:** Negligible overhead compared to alternatives
5. **Standard Solution:** Follows JavaScript best practices for prototype pollution prevention

### Alternative Approaches Considered

1. **Null Prototype Object:** `Object.create(null)` for ENTITY_BUILTIN_COLUMNS
   - Pros: Prevents prototype chain access entirely
   - Cons: Requires changing the object definition, may affect TypeScript types

2. **Map Instead of Object:** Use `Map<string, string>`
   - Pros: No prototype chain issues
   - Cons: Requires more extensive refactoring, changes API surface

3. **Allowlist Validation:** Check fieldId against known keys first
   - Pros: Explicit validation
   - Cons: Duplicates the keys, maintenance burden

**Decision:** Use `Object.hasOwn()` for minimal, clear, and effective fix.

## Implementation Checklist

### 1. Code Changes

#### File: `postgresCatalog.ts`
- [ ] Locate the `listEntitiesPaginated` method (around line 196)
- [ ] Replace `ENTITY_BUILTIN_COLUMNS[cond.fieldId] ??` with guarded lookup
- [ ] Ensure the ternary logic remains correct for custom fields

#### File: `sqliteCatalog.ts`
- [ ] Locate the `listEntitiesPaginated` method (around line 193)
- [ ] Replace `ENTITY_BUILTIN_COLUMNS[cond.fieldId] ??` with guarded lookup
- [ ] Ensure the ternary logic remains correct for custom fields

#### File: `filterBuilder.ts` (Optional Documentation)
- [ ] Add JSDoc comment to `ENTITY_BUILTIN_COLUMNS` explaining the security consideration
- [ ] Document that lookups should use `Object.hasOwn()` guard

### 2. Test Coverage

#### Unit Tests (New File or Existing)
Create tests in `arch-register-packages/server/src/domain/catalog/db/` or contract tests:

- [ ] Test filtering with `fieldId: "toString"` - should be ignored/rejected
- [ ] Test filtering with `fieldId: "constructor"` - should be ignored/rejected
- [ ] Test filtering with `fieldId: "__proto__"` - should be ignored/rejected
- [ ] Test filtering with `fieldId: "hasOwnProperty"` - should be ignored/rejected
- [ ] Test filtering with valid built-in fields (e.g., `_name`, `_slug`) - should work
- [ ] Test filtering with valid custom fields (e.g., `customField`) - should work
- [ ] Test filtering with invalid custom fields (e.g., `invalid@field`) - should be ignored

#### Integration/Contract Tests
Add to `arch-register-packages/server/src/db/contract-tests/catalog.contract.test.ts`:

- [ ] Add test case in existing `listEntitiesPaginated` describe block
- [ ] Test that prototype property names don't cause 500 errors
- [ ] Verify that results are empty or filtered correctly (no SQL errors)

### 3. Validation Steps

- [ ] Run TypeScript type checking: `pnpm lint:tsc`
- [ ] Run linting: `pnpm lint`
- [ ] Run unit tests: `vitest run arch-register-packages/server/src/domain/catalog/db/`
- [ ] Run contract tests: `pnpm --filter @arch-register/server test:db-contract`
- [ ] Run full test suite: `pnpm test`
- [ ] Manual testing with API requests containing prototype property names

### 4. Documentation

- [ ] Update issue #2058 with implementation details
- [ ] Add inline code comments explaining the security fix
- [ ] Consider adding to security documentation if it exists

## Test Scenarios

### Scenario 1: Prototype Property in Filter
```typescript
// Input
{
  conditions: [
    { fieldId: "toString", op: "equals", value: "test" }
  ]
}

// Expected: No SQL error, condition ignored, returns all entities (or filtered by other conditions)
```

### Scenario 2: Valid Built-in Field
```typescript
// Input
{
  conditions: [
    { fieldId: "_name", op: "equals", value: "MyEntity" }
  ]
}

// Expected: Filters by e.name = 'MyEntity'
```

### Scenario 3: Valid Custom Field
```typescript
// Input
{
  conditions: [
    { fieldId: "customField", op: "equals", value: "value" }
  ]
}

// Expected: Filters by e.data->>'customField' = 'value' (Postgres) or json_extract(e.data, '$.customField') = 'value' (SQLite)
```

### Scenario 4: Multiple Conditions with Prototype Property
```typescript
// Input
{
  conditions: [
    { fieldId: "_name", op: "equals", value: "MyEntity" },
    { fieldId: "constructor", op: "equals", value: "test" }
  ]
}

// Expected: Only filters by _name, ignores constructor
```

## Code Examples

### Before (Vulnerable)
```typescript
for (const cond of filters?.conditions ?? []) {
  const col =
    ENTITY_BUILTIN_COLUMNS[cond.fieldId] ??
    (isValidFieldId(cond.fieldId) ? `(e.data->>'${cond.fieldId}')` : null);
  if (!col) continue;
  const clause = buildConditionClause(col, cond, addParam, 'postgres');
  if (clause) whereParts.push(clause);
}
```

### After (Fixed)
```typescript
for (const cond of filters?.conditions ?? []) {
  const col = Object.hasOwn(ENTITY_BUILTIN_COLUMNS, cond.fieldId)
    ? ENTITY_BUILTIN_COLUMNS[cond.fieldId]
    : (isValidFieldId(cond.fieldId) ? `(e.data->>'${cond.fieldId}')` : null);
  if (!col) continue;
  const clause = buildConditionClause(col, cond, addParam, 'postgres');
  if (clause) whereParts.push(clause);
}
```

## Risk Assessment

### Low Risk Changes
- Using `Object.hasOwn()` is a standard JavaScript security practice
- Changes are localized to two methods
- Existing tests should continue to pass
- No API changes required

### Testing Strategy
- Comprehensive unit tests for prototype properties
- Contract tests to ensure database behavior
- Manual API testing with malicious inputs

## Success Criteria

- [ ] No 500 errors when filtering with prototype property names
- [ ] All existing tests pass
- [ ] New tests cover all prototype pollution scenarios
- [ ] Code review confirms security fix
- [ ] Documentation updated

## Next Steps for Implementation

1. Switch to `code` or `advanced` mode
2. Implement the fix in both PostgreSQL and SQLite implementations
3. Add comprehensive test coverage
4. Run validation suite
5. Create pull request with security label
6. Request security review if required by team process
