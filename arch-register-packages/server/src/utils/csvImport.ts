/**
 * CSV import utility functions for parsing and validating CSV data
 */
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { parseCurrencyValue } from './currencyValue';
import { isMultiValuedScalarField } from '../domain/catalog/entityScalarValues';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export type ParsedCsvRow = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  existingId?: string;
};

export type CsvParseResult = {
  headers: string[];
  rows: ParsedCsvRow[];
  totalRows: number;
  validRows: number;
};

export type CsvParseOptions = {
  requiredFields?: string[];
};

/**
 * Parses CSV content into structured data
 * @param csvContent Raw CSV string content
 * @returns Parsed CSV data with headers and rows
 */
export const parseCsv = (
  csvContent: string,
  { requiredFields = ['Name'] }: CsvParseOptions = {}
): CsvParseResult => {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const firstLine = lines[0];
  if (!firstLine) {
    throw new Error('CSV file is empty');
  }

  // Detect delimiter from first line (prefer semicolon if present, otherwise comma)
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Parse header row
  const headers = parseCsvLine(firstLine, delimiter);

  if (headers.length === 0) {
    throw new Error('CSV header row is empty');
  }

  // Parse data rows
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseCsvLine(line, delimiter);
    const errors: string[] = [];
    const data: Record<string, string> = {};
    let existingId: string | undefined;

    // Map values to headers
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;

      const value = values[j] ?? '';
      data[header] = value;

      // Capture ID if present for upsert detection
      if (header === 'ID' && value.trim()) {
        existingId = value.trim();
      }
    }

    for (const requiredField of requiredFields) {
      if (!data[requiredField] || data[requiredField].trim() === '') {
        errors.push(`${requiredField} is required`);
      }
    }

    rows.push({
      rowNumber: i + 1,
      data,
      errors,
      existingId
    });
  }

  const validRows = rows.filter(r => r.errors.length === 0).length;

  return {
    headers,
    rows,
    totalRows: rows.length,
    validRows
  };
};

/**
 * Parses a single CSV line, handling quoted values and escaped quotes
 */
const parseCsvLine = (line: string, delimiter: string = ','): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
};

/**
 * Validates CSV data against a schema
 * @param rows Parsed CSV rows
 * @param fields Schema fields to validate against
 * @returns Updated rows with validation errors
 */
export const validateCsvData = (rows: ParsedCsvRow[], fields: SchemaField[]): ParsedCsvRow[] => {
  const fieldMap = new Map(fields.map(f => [f.name, f]));

  return rows.map(row => {
    const errors = [...row.errors];

    // Validate each field
    for (const [key, value] of Object.entries(row.data)) {
      const field = fieldMap.get(key);

      if (!field) {
        // Skip standard fields and unknown fields
        if (
          ![
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
          ].includes(key)
        ) {
          errors.push(`Unknown field: ${key}`);
        }
        continue;
      }

      // Validate field types
      if (value && value.trim() !== '') {
        if (isMultiValuedScalarField(field)) {
          try {
            const parsed: unknown = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              errors.push(`${field.name} must be a JSON array`);
            }
          } catch {
            errors.push(`${field.name} must be a JSON array`);
          }
          continue;
        }
        switch (field.type) {
          case 'boolean':
            if (!['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
              errors.push(`${field.name} must be a boolean (true/false)`);
            }
            break;
          case 'date':
            if (!isValidIsoDate(value)) {
              errors.push(`${field.name} must be a date in YYYY-MM-DD format`);
            }
            break;
          case 'number':
            if (!Number.isInteger(Number(value))) {
              errors.push(`${field.name} must be a whole number`);
            }
            break;
          case 'currency':
            if (!parseCurrencyValue(value)) {
              errors.push(`${field.name} must use the format amount CODE, for example 1200.50 USD`);
            }
            break;
          case 'typedRelation':
            errors.push(`${field.name} is a typed relation field and cannot be set via CSV import`);
            break;
        }
      }
    }

    return {
      ...row,
      errors
    };
  });
};

/**
 * Converts CSV row data to entity creation format
 * @param row Parsed CSV row
 * @param fields Schema fields
 * @returns Entity data ready for creation
 */
export const csvRowToEntity = (
  row: Record<string, string>,
  fields: SchemaField[]
): Record<string, unknown> => {
  const entity: Record<string, unknown> = {};
  const fieldMap = new Map(fields.map(f => [f.name, f]));

  for (const [key, value] of Object.entries(row)) {
    const trimmedValue = value.trim();

    // Handle standard fields
    if (key === 'Name') {
      entity._name = trimmedValue;
      continue;
    }
    if (key === 'Slug') {
      if (trimmedValue) entity._slug = trimmedValue;
      continue;
    }
    if (key === 'Namespace') {
      if (trimmedValue) entity._namespace = trimmedValue;
      continue;
    }
    if (key === 'Description') {
      if (trimmedValue) entity._description = trimmedValue;
      continue;
    }
    if (key === 'Owner') {
      entity._owner = trimmedValue === '' ? null : trimmedValue;
      continue;
    }
    if (key === 'Lifecycle') {
      entity._lifecycle = trimmedValue === '' ? null : trimmedValue;
      continue;
    }
    if (key === 'Tags') {
      if (trimmedValue) {
        entity._tags = trimmedValue
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
      }
      continue;
    }
    if (key === 'ID' || key === 'Schema Type' || key === 'Links') {
      // Skip these fields (ID is used for upsert detection, not entity data)
      continue;
    }

    // Handle custom fields
    const field = fieldMap.get(key);
    if (!field) continue;

    const multiValue = isMultiValuedScalarField(field);
    if (!trimmedValue && !multiValue) continue;

    let parsedMultiValue: unknown[] | undefined;
    if (multiValue) {
      if (!trimmedValue) {
        parsedMultiValue = [];
      } else {
        try {
          const parsed: unknown = JSON.parse(trimmedValue);
          parsedMultiValue = Array.isArray(parsed) ? parsed : [];
        } catch {
          parsedMultiValue = [];
        }
      }
    }

    switch (field.type) {
      case 'boolean':
        entity[field.id] = multiValue
          ? (parsedMultiValue ?? []).map(value =>
              ['true', 'yes', '1'].includes(String(value).toLowerCase())
            )
          : ['true', 'yes', '1'].includes(trimmedValue.toLowerCase());
        break;
      case 'select':
        entity[field.id] = multiValue
          ? (parsedMultiValue ?? []).filter((value): value is string => typeof value === 'string')
          : trimmedValue;
        break;
      case 'reference':
      case 'containment':
        // Store as comma-separated names for now, will be resolved later
        entity[field.id] = trimmedValue;
        break;
      case 'date':
      case 'text':
      case 'longtext':
        entity[field.id] = multiValue
          ? (parsedMultiValue ?? []).filter((value): value is string => typeof value === 'string')
          : trimmedValue;
        break;
      case 'number':
        entity[field.id] = multiValue
          ? (parsedMultiValue ?? []).map(value => Number(value))
          : Number(trimmedValue);
        break;
      case 'currency': {
        if (multiValue) {
          entity[field.id] = (parsedMultiValue ?? [])
            .map(value => parseCurrencyValue(value))
            .filter(value => value != null);
        } else {
          const currency = parseCurrencyValue(trimmedValue);
          if (currency) entity[field.id] = currency;
        }
        break;
      }
      case 'typedRelation':
        // Rejected in validateCsvData — relation instances aren't part of the entity's data blob.
        break;
    }
  }

  return entity;
};
