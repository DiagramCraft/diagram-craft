/**
 * CSV utility functions for generating CSV files from data
 */

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles internal quotes
 */
export const escapeCsvValue = (value: unknown): string => {
  if (value == null) return '';
  
  const str = String(value);
  
  // Check if value needs quoting
  const needsQuoting = str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');
  
  if (!needsQuoting) return str;
  
  // Escape internal quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  
  return `"${escaped}"`;
};

/**
 * Generates CSV content from an array of objects
 * @param data Array of objects to convert to CSV
 * @param columns Array of column names (keys to extract from objects)
 * @returns CSV string with header row and data rows
 */
export const generateCsv = (data: Record<string, unknown>[], columns: string[]): string => {
  const rows: string[] = [];
  
  // Header row
  rows.push(columns.map(escapeCsvValue).join(','));
  
  // Data rows
  for (const item of data) {
    const row = columns.map(col => escapeCsvValue(item[col]));
    rows.push(row.join(','));
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
