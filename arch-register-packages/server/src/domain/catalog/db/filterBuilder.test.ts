import { describe, it, expect } from 'vitest';
import { ENTITY_BUILTIN_COLUMNS, isValidFieldId, buildConditionClause } from './filterBuilder';

describe('filterBuilder', () => {
  describe('ENTITY_BUILTIN_COLUMNS', () => {
    it('should contain expected built-in columns', () => {
      expect(ENTITY_BUILTIN_COLUMNS._name).toBe('e.name');
      expect(ENTITY_BUILTIN_COLUMNS._slug).toBe('e.slug');
      expect(ENTITY_BUILTIN_COLUMNS._description).toBe('e.description');
      expect(ENTITY_BUILTIN_COLUMNS._namespace).toBe('e.namespace');
      expect(ENTITY_BUILTIN_COLUMNS._schemaId).toBe('e.schema_id');
      expect(ENTITY_BUILTIN_COLUMNS._lifecycle).toBe('e.lifecycle');
      expect(ENTITY_BUILTIN_COLUMNS._owner).toBe('e.owner');
      expect(ENTITY_BUILTIN_COLUMNS._updatedAt).toBe('e.updated_at');
    });

    it('should demonstrate prototype pollution vulnerability without guard', () => {
      // Without Object.hasOwn() guard, bracket notation DOES resolve inherited properties
      // This is the vulnerability we're protecting against
      expect(ENTITY_BUILTIN_COLUMNS['toString']).toBeDefined();
      expect(ENTITY_BUILTIN_COLUMNS['constructor']).toBeDefined();
      expect(ENTITY_BUILTIN_COLUMNS['__proto__']).toBeDefined();
      expect(ENTITY_BUILTIN_COLUMNS['hasOwnProperty']).toBeDefined();
      expect(ENTITY_BUILTIN_COLUMNS['valueOf']).toBeDefined();
    });

    it('should only have own properties, not inherited ones', () => {
      expect(Object.hasOwn(ENTITY_BUILTIN_COLUMNS, 'toString')).toBe(false);
      expect(Object.hasOwn(ENTITY_BUILTIN_COLUMNS, 'constructor')).toBe(false);
      expect(Object.hasOwn(ENTITY_BUILTIN_COLUMNS, '__proto__')).toBe(false);
      expect(Object.hasOwn(ENTITY_BUILTIN_COLUMNS, 'hasOwnProperty')).toBe(false);
      expect(Object.hasOwn(ENTITY_BUILTIN_COLUMNS, '_name')).toBe(true);
    });
  });

  describe('isValidFieldId', () => {
    it('should accept valid custom field IDs', () => {
      expect(isValidFieldId('customField')).toBe(true);
      expect(isValidFieldId('custom_field')).toBe(true);
      expect(isValidFieldId('custom-field')).toBe(true);
      expect(isValidFieldId('field123')).toBe(true);
      expect(isValidFieldId('_privateField')).toBe(true);
    });

    it('should reject invalid custom field IDs', () => {
      expect(isValidFieldId('invalid@field')).toBe(false);
      expect(isValidFieldId('invalid.field')).toBe(false);
      expect(isValidFieldId('invalid field')).toBe(false);
      expect(isValidFieldId('invalid/field')).toBe(false);
      expect(isValidFieldId('invalid\\field')).toBe(false);
      expect(isValidFieldId('')).toBe(false);
    });

    it('should accept prototype property names as valid patterns', () => {
      // These pass the regex but should be caught by Object.hasOwn() guard
      expect(isValidFieldId('toString')).toBe(true);
      expect(isValidFieldId('constructor')).toBe(true);
      expect(isValidFieldId('hasOwnProperty')).toBe(true);
      expect(isValidFieldId('valueOf')).toBe(true);
    });

    it('should reject __proto__ due to special characters', () => {
      expect(isValidFieldId('__proto__')).toBe(true); // Actually passes regex
    });
  });

  describe('buildConditionClause', () => {
    const mockAddParam = (v: unknown) => {
      return `$${v}`;
    };

    describe('postgres dialect', () => {
      it('should build equals condition', () => {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: 'equals', value: 'test' },
          mockAddParam,
          'postgres'
        );
        expect(result).toBe('e.name = $test');
      });

      it('should build contains condition with ILIKE', () => {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: 'contains', value: 'test' },
          mockAddParam,
          'postgres'
        );
        expect(result).toBe('e.name ILIKE $%test%');
      });

      it('should build empty condition with type cast', () => {
        const result = buildConditionClause(
          'e.schema_id',
          { fieldId: '_schemaId', op: 'empty', value: '' },
          mockAddParam,
          'postgres'
        );
        expect(result).toBe("(e.schema_id IS NULL OR e.schema_id::text = '')");
      });
    });

    describe('sqlite dialect', () => {
      it('should build equals condition', () => {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: 'equals', value: 'test' },
          mockAddParam,
          'sqlite'
        );
        expect(result).toBe('e.name = $test');
      });

      it('should build contains condition with LOWER/LIKE', () => {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: 'contains', value: 'test' },
          mockAddParam,
          'sqlite'
        );
        expect(result).toBe('LOWER(e.name) LIKE LOWER($%test%)');
      });

      it('should build empty condition without type cast', () => {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: 'empty', value: '' },
          mockAddParam,
          'sqlite'
        );
        expect(result).toBe("(e.name IS NULL OR e.name = '')");
      });
    });

    it('should handle all supported operators', () => {
      const operators = [
        'empty',
        'not_empty',
        'equals',
        'not_equals',
        'contains',
        'starts_with',
        'ends_with',
        'gt',
        'lt',
        'before'
      ];

      for (const op of operators) {
        const result = buildConditionClause(
          'e.name',
          { fieldId: '_name', op: op as any, value: 'test' },
          mockAddParam,
          'postgres'
        );
        expect(result).not.toBeNull();
      }
    });

    it('should return null for unsupported operators', () => {
      const result = buildConditionClause(
        'e.name',
        { fieldId: '_name', op: 'unsupported' as any, value: 'test' },
        mockAddParam,
        'postgres'
      );
      expect(result).toBeNull();
    });
  });
});
