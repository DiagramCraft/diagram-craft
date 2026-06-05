/**
 * CSV utility functions for generating CSV files from data
 */

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains delimiter, quote, or newline
 * - Doubles internal quotes
 */
export const escapeCsvValue = (value: unknown, delimiter: string = ';'): string => {
  if (value == null) return '';
  
  const str = String(value);
  
  // Check if value needs quoting
  const needsQuoting = str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r');
  
  if (!needsQuoting) return str;
  
  // Escape internal quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  
  return `"${escaped}"`;
};

/**
 * Generates CSV content from an array of objects
 * @param data Array of objects to convert to CSV
 * @param columns Array of column names (keys to extract from objects)
 * @param delimiter The delimiter to use (default: semicolon for Excel compatibility)
 * @returns CSV string with header row and data rows
 */
export const generateCsv = (data: Record<string, unknown>[], columns: string[], delimiter: string = ';'): string => {
  const rows: string[] = [];
  
  // Header row
  rows.push(columns.map(col => escapeCsvValue(col, delimiter)).join(delimiter));
  
  // Data rows
  for (const item of data) {
    const row = columns.map(col => escapeCsvValue(item[col], delimiter));
    rows.push(row.join(delimiter));
  }
  
  return rows.join('\n');
};

/**
 * Formats an array of strings as a comma-separated list for CSV
 */
export const formatArrayForCsv = (arr: unknown[]): string => {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map(String).join(', ');
};
