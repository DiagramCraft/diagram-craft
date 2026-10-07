import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createEntityQueryDialectAdapter } from './entityQueryIRDialect';

describe('EntityQueryDialectAdapter.nowDateLiteral', () => {
  describe('postgres', () => {
    const adapter = createEntityQueryDialectAdapter('postgres');

    it('renders today with no offset', () => {
      expect(adapter.nowDateLiteral()).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
      );
      expect(adapter.nowDateLiteral(0)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
      );
    });

    it('renders a positive offset', () => {
      expect(adapter.nowDateLiteral(30)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date + INTERVAL '30 days', 'YYYY-MM-DD')`
      );
    });

    it('renders a negative offset', () => {
      expect(adapter.nowDateLiteral(-7)).toBe(
        `to_char((NOW() AT TIME ZONE 'UTC')::date + INTERVAL '-7 days', 'YYYY-MM-DD')`
      );
    });
  });

  describe('sqlite', () => {
    const adapter = createEntityQueryDialectAdapter('sqlite');

    it('renders today with no offset', () => {
      expect(adapter.nowDateLiteral()).toBe(`date('now')`);
      expect(adapter.nowDateLiteral(0)).toBe(`date('now')`);
    });

    it('renders a positive offset', () => {
      expect(adapter.nowDateLiteral(30)).toBe(`date('now', '+30 days')`);
    });

    it('renders a negative offset', () => {
      expect(adapter.nowDateLiteral(-7)).toBe(`date('now', '-7 days')`);
    });
  });
});

describe('EntityQueryDialectAdapter SQL fragments', () => {
  describe('postgres', () => {
    const adapter = createEntityQueryDialectAdapter('postgres');

    it('renders nested JSON paths and array traversal', () => {
      expect(adapter.jsonPathText('e.data', ['query', 'schemaId'])).toBe(
        "e.data->'query'->>'schemaId'"
      );
      expect(adapter.jsonPathValue('e.data', ['query', 'schemaId'])).toBe(
        "e.data->'query'->'schemaId'"
      );
      expect(adapter.jsonArrayContains('e', 'children', 'target')).toBe(
        "EXISTS (SELECT 1 FROM jsonb_array_elements_text(e.data->'children') t WHERE t = target.id::text)"
      );
      expect(adapter.jsonArrayElementPosition('r', 'targets', 'e.id')).toBe(
        "(SELECT array_item.ordinal FROM jsonb_array_elements_text(r.data->'targets') WITH ORDINALITY AS array_item(value, ordinal) WHERE array_item.value = e.id::text LIMIT 1)"
      );
      expect(adapter.jsonArrayLateralElement('e', 'children', 'child_arr')).toEqual({
        joinClause:
          "JOIN LATERAL jsonb_array_elements_text(e.data->'children') WITH ORDINALITY AS child_arr(value, ordinal) ON TRUE",
        valueColumn: 'child_arr.value::uuid',
        ordinalColumn: 'child_arr.ordinal'
      });
    });

    it('renders JSON values and state expressions', () => {
      expect(adapter.jsonArray(['1', '2'])).toBe('jsonb_build_array(1, 2)');
      expect(adapter.toJson('e.id')).toBe('to_jsonb(e.id)');
      expect(adapter.wrapJson('value')).toBe('value');
      expect(adapter.mergeJson('left', 'right')).toBe('left || right');
      expect(adapter.stateText('e.state', 'project_id')).toBe(
        "NULLIF(e.state->>'project_id', '')::uuid"
      );
      expect(adapter.stateValue('e.state', 'data')).toBe("e.state->'data'");
      expect(adapter.emptyObject).toBe("'{}'::jsonb");
      expect(adapter.emptyArray).toBe("'[]'::jsonb");
      expect(adapter.nullJson).toBe('NULL::jsonb');
    });
  });

  describe('sqlite', () => {
    const adapter = createEntityQueryDialectAdapter('sqlite');

    it('renders nested JSON paths and array traversal', () => {
      expect(adapter.jsonPathText('e.data', ['query', 'schemaId'])).toBe(
        "json_extract(e.data, '$.query.schemaId')"
      );
      expect(adapter.jsonPathValue('e.data', ['query', 'schemaId'])).toBe(
        "json_extract(e.data, '$.query.schemaId')"
      );
      expect(adapter.jsonArrayContains('e', 'children', 'target')).toBe(
        "EXISTS (SELECT 1 FROM json_each(e.data, '$.children') WHERE value = target.id)"
      );
      expect(adapter.jsonArrayElementPosition('r', 'targets', 'e.id')).toBe(
        "(SELECT array_item.key FROM json_each(r.data, '$.targets') AS array_item WHERE array_item.value = e.id LIMIT 1)"
      );
      expect(adapter.jsonArrayLateralElement('e', 'children', 'child_arr')).toEqual({
        joinClause: "JOIN json_each(e.data, '$.children') AS child_arr",
        valueColumn: 'child_arr.value',
        ordinalColumn: 'child_arr.key'
      });
    });

    it('renders JSON values and state expressions', () => {
      expect(adapter.jsonArray(['1', '2'])).toBe('json_array(1, 2)');
      expect(adapter.toJson('e.id')).toBe('e.id');
      expect(adapter.wrapJson('value')).toBe('json(value)');
      expect(adapter.mergeJson('left', 'right')).toBe('json_patch(left, right)');
      expect(adapter.stateText('e.state', 'project_id')).toBe(
        "json_extract(e.state, '$.project_id')"
      );
      expect(adapter.stateValue('e.state', 'data')).toBe("json_extract(e.state, '$.data')");
      expect(adapter.emptyObject).toBe("'{}'");
      expect(adapter.emptyArray).toBe("'[]'");
      expect(adapter.nullJson).toBe('NULL');
    });

    it('rejects unsafe JSON field identifiers', () => {
      expect(() => adapter.jsonPathText('e.data', ['bad.field'])).toThrow('Invalid field id');
      expect(() => adapter.jsonPathValue('e.data', ['bad.field'])).toThrow('Invalid field id');
    });
  });
});

describe('EntityQueryDialectAdapter.durationDays', () => {
  it('renders the postgres expression over the JSON amount and unit', () => {
    expect(createEntityQueryDialectAdapter('postgres').durationDays('e.data', 'period')).toBe(
      `(CAST(e.data->'period'->>'amount' AS NUMERIC) * CASE e.data->'period'->>'unit' WHEN 'weeks' THEN 7 WHEN 'months' THEN 30.4375 WHEN 'years' THEN 365.25 ELSE 1 END)`
    );
  });

  it('normalises amounts to days when evaluated by sqlite, so units compare', () => {
    const db = new Database(':memory:');
    const expression = createEntityQueryDialectAdapter('sqlite').durationDays('data', 'period');
    const days = (period: unknown) =>
      (
        db.prepare(`SELECT ${expression} AS days FROM (SELECT ? AS data)`).get(
          JSON.stringify({ period })
        ) as { days: number | null }
      ).days;

    expect(days({ amount: 2, unit: 'weeks' })).toBe(14);
    expect(days({ amount: 1, unit: 'years' })).toBeGreaterThan(
      days({ amount: 11, unit: 'months' }) ?? 0
    );
    expect(days({ amount: 12, unit: 'months' })).toBeCloseTo(365.25, 5);
    expect(days(undefined)).toBeNull();
    db.close();
  });
});
