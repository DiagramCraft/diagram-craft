import { describe, expect, it } from 'vitest';
import { csvRowToEntity, parseCsv, validateCsvData } from './csvImport';
import { SchemaField } from '@arch-register/api-types/schemaContract';

// ── parseCsv ──────────────────────────────────────────────────

describe('parseCsv', () => {
  it('throws on empty input', () => {
    expect(() => parseCsv('')).toThrow('CSV file is empty');
  });

  it('throws on whitespace-only input', () => {
    expect(() => parseCsv('   \n   ')).toThrow('CSV file is empty');
  });

  it('parses headers and a single data row (comma delimiter)', () => {
    const result = parseCsv('Name,Description\nFoo,Bar');
    expect(result.headers).toEqual(['Name', 'Description']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.data).toEqual({ Name: 'Foo', Description: 'Bar' });
    expect(result.rows[0]!.errors).toHaveLength(0);
    expect(result.rows[0]!.rowNumber).toBe(2);
  });

  it('prefers semicolon delimiter when present in header', () => {
    const result = parseCsv('Name;Description\nFoo;Bar');
    expect(result.headers).toEqual(['Name', 'Description']);
    expect(result.rows[0]!.data).toEqual({ Name: 'Foo', Description: 'Bar' });
  });

  it('captures ID field as existingId', () => {
    const result = parseCsv('ID,Name\nabc-123,Foo');
    expect(result.rows[0]!.existingId).toBe('abc-123');
  });

  it('does not set existingId when ID column is empty', () => {
    const result = parseCsv('ID,Name\n,Foo');
    expect(result.rows[0]!.existingId).toBeUndefined();
  });

  it('reports error when Name field is missing', () => {
    const result = parseCsv('Name,Description\n,Some description');
    expect(result.rows[0]!.errors).toContain('Name is required');
  });

  it('counts total and valid rows correctly', () => {
    const csv = 'Name\nAlice\n\nBob';
    const result = parseCsv(csv);
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
  });

  it('parses quoted values with commas inside', () => {
    const result = parseCsv('Name,Description\n"Smith, John","An employee"');
    expect(result.rows[0]!.data['Name']).toBe('Smith, John');
  });

  it('parses escaped quotes (doubled) inside quoted values', () => {
    const result = parseCsv('Name,Description\n"Say ""hello""",Test');
    expect(result.rows[0]!.data['Name']).toBe('Say "hello"');
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('Name,Desc\r\nFoo,Bar');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.data['Name']).toBe('Foo');
  });
});

// ── validateCsvData ───────────────────────────────────────────

describe('validateCsvData', () => {
  const boolField: SchemaField = { id: 'active', name: 'Active', type: 'boolean' };
  const dateField: SchemaField = { id: 'go_live', name: 'Go Live', type: 'date' };

  it('passes through rows with no schema fields', () => {
    const rows = [{ rowNumber: 2, data: { Name: 'Foo' }, errors: [] }];
    const result = validateCsvData(rows, []);
    expect(result[0]!.errors).toHaveLength(0);
  });

  it('reports unknown field error for columns not in schema or standard fields', () => {
    const rows = [{ rowNumber: 2, data: { Name: 'Foo', Aliens: 'yes' }, errors: [] }];
    const result = validateCsvData(rows, []);
    expect(result[0]!.errors).toContain('Unknown field: Aliens');
  });

  it('does not report error for standard fields (ID, Name, Slug, etc.)', () => {
    const standard = [
      'ID',
      'Name',
      'Slug',
      'Namespace',
      'Description',
      'Owner',
      'Lifecycle',
      'Tags',
      'Links',
      'Schema Type'
    ];
    const data = Object.fromEntries(standard.map(k => [k, 'value']));
    const rows = [{ rowNumber: 2, data, errors: [] }];
    const result = validateCsvData(rows, []);
    expect(result[0]!.errors).toHaveLength(0);
  });

  it('accepts valid boolean values', () => {
    for (const val of ['true', 'false', 'yes', 'no', '1', '0', 'TRUE', 'YES']) {
      const rows = [{ rowNumber: 2, data: { Active: val }, errors: [] }];
      const result = validateCsvData(rows, [boolField]);
      expect(result[0]!.errors).toHaveLength(0);
    }
  });

  it('rejects invalid boolean value', () => {
    const rows = [{ rowNumber: 2, data: { Active: 'maybe' }, errors: [] }];
    const result = validateCsvData(rows, [boolField]);
    expect(result[0]!.errors).toContain('Active must be a boolean (true/false)');
  });

  it('skips boolean validation when value is empty', () => {
    const rows = [{ rowNumber: 2, data: { Active: '' }, errors: [] }];
    const result = validateCsvData(rows, [boolField]);
    expect(result[0]!.errors).toHaveLength(0);
  });

  it('accepts valid ISO date values', () => {
    const rows = [{ rowNumber: 2, data: { 'Go Live': '2026-06-30' }, errors: [] }];
    const result = validateCsvData(rows, [dateField]);
    expect(result[0]!.errors).toHaveLength(0);
  });

  it('rejects invalid date value', () => {
    const rows = [{ rowNumber: 2, data: { 'Go Live': 'June 30 2026' }, errors: [] }];
    const result = validateCsvData(rows, [dateField]);
    expect(result[0]!.errors).toContain('Go Live must be a date in YYYY-MM-DD format');
  });

  it('skips date validation when value is empty', () => {
    const rows = [{ rowNumber: 2, data: { 'Go Live': '' }, errors: [] }];
    const result = validateCsvData(rows, [dateField]);
    expect(result[0]!.errors).toHaveLength(0);
  });

  it('preserves existing errors', () => {
    const rows = [{ rowNumber: 2, data: { Name: '' }, errors: ['Name is required'] }];
    const result = validateCsvData(rows, []);
    expect(result[0]!.errors).toContain('Name is required');
  });
});

// ── csvRowToEntity ────────────────────────────────────────────

describe('csvRowToEntity', () => {
  it('maps standard fields', () => {
    const row = {
      Name: 'Foo',
      Slug: 'foo',
      Namespace: 'ns',
      Description: 'desc',
      Owner: 'team-a',
      Lifecycle: 'prod'
    };
    const result = csvRowToEntity(row, []);
    expect(result).toMatchObject({
      _name: 'Foo',
      _slug: 'foo',
      _namespace: 'ns',
      _description: 'desc',
      _owner: 'team-a',
      _lifecycle: 'prod'
    });
  });

  it('sets _owner and _lifecycle to null when empty', () => {
    const row = { Name: 'Foo', Owner: '', Lifecycle: '' };
    const result = csvRowToEntity(row, []);
    expect(result._owner).toBeNull();
    expect(result._lifecycle).toBeNull();
  });

  it('omits _slug and _namespace when empty', () => {
    const row = { Name: 'Foo', Slug: '', Namespace: '' };
    const result = csvRowToEntity(row, []);
    expect(result).not.toHaveProperty('_slug');
    expect(result).not.toHaveProperty('_namespace');
  });

  it('parses Tags as array', () => {
    const row = { Name: 'Foo', Tags: 'a, b, c' };
    const result = csvRowToEntity(row, []);
    expect(result._tags).toEqual(['a', 'b', 'c']);
  });

  it('skips ID, Schema Type, and Links fields', () => {
    const row = { 'Name': 'Foo', 'ID': 'abc', 'Schema Type': 'app', 'Links': 'http://x' };
    const result = csvRowToEntity(row, []);
    expect(result).not.toHaveProperty('ID');
    expect(result).not.toHaveProperty('Schema Type');
    expect(result).not.toHaveProperty('Links');
  });

  it('converts boolean fields', () => {
    const boolField: SchemaField = { id: 'active', name: 'Active', type: 'boolean' };
    expect(csvRowToEntity({ Name: 'X', Active: 'true' }, [boolField]).active).toBe(true);
    expect(csvRowToEntity({ Name: 'X', Active: 'yes' }, [boolField]).active).toBe(true);
    expect(csvRowToEntity({ Name: 'X', Active: '1' }, [boolField]).active).toBe(true);
    expect(csvRowToEntity({ Name: 'X', Active: 'false' }, [boolField]).active).toBe(false);
    expect(csvRowToEntity({ Name: 'X', Active: 'no' }, [boolField]).active).toBe(false);
  });

  it('converts select fields as array', () => {
    const selectField: SchemaField = { id: 'env', name: 'Env', type: 'select', enumId: 'e1' };
    const result = csvRowToEntity({ Name: 'X', Env: 'prod, staging' }, [selectField]);
    expect(result.env).toEqual(['prod', 'staging']);
  });

  it('stores reference fields as string', () => {
    const refField: SchemaField = {
      id: 'dep',
      name: 'Dep',
      type: 'reference',
      schemaId: 'svc',
      minCount: 0,
      maxCount: -1
    };
    const result = csvRowToEntity({ Name: 'X', Dep: 'entity-1,entity-2' }, [refField]);
    expect(result.dep).toBe('entity-1,entity-2');
  });

  it('stores text fields as string', () => {
    const textField: SchemaField = { id: 'note', name: 'Note', type: 'text' };
    const result = csvRowToEntity({ Name: 'X', Note: 'hello' }, [textField]);
    expect(result.note).toBe('hello');
  });

  it('stores date fields as string', () => {
    const dateField: SchemaField = { id: 'go_live', name: 'Go Live', type: 'date' };
    const result = csvRowToEntity({ 'Name': 'X', 'Go Live': '2026-06-30' }, [dateField]);
    expect(result.go_live).toBe('2026-06-30');
  });

  it('skips custom field with empty value', () => {
    const textField: SchemaField = { id: 'note', name: 'Note', type: 'text' };
    const result = csvRowToEntity({ Name: 'X', Note: '' }, [textField]);
    expect(result).not.toHaveProperty('note');
  });
});
