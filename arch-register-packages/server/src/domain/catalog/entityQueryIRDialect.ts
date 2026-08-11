export type EntityQueryDialect = 'postgres' | 'sqlite';

/** Dialect-specific tokens used by the logical query-plan renderer. */
export type EntityQueryDialectAdapter = {
  placeholder: (parameterIndex: number) => string;
  limitAll: string;
  trueLiteral: string;
  falseLiteral: string;
  jsonFieldText: (expression: string, fieldId: string) => string;
  jsonFieldValue: (expression: string, fieldId: string) => string;
  jsonArrayElements: (expression: string) => { from: string; value: string };
  jsonObject: (entries: string[]) => string;
  jsonAggregate: (expression: string) => string;
  mergeJson: (left: string, right: string) => string;
};

const assertSafeJsonFieldId = (fieldId: string): void => {
  if (!/^[a-zA-Z0-9_-]+$/.test(fieldId)) {
    throw new Error(`Invalid field id '${fieldId}'`);
  }
};

export const createEntityQueryDialectAdapter = (
  dialect: EntityQueryDialect
): EntityQueryDialectAdapter => {
  const jsonFieldText = (expression: string, fieldId: string): string => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? `(${expression}->>'${fieldId}')`
      : `json_extract(${expression}, '$.${fieldId}')`;
  };
  const jsonFieldValue = (expression: string, fieldId: string): string => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? `${expression}->'${fieldId}'`
      : `json_extract(${expression}, '$.${fieldId}')`;
  };

  return {
    placeholder: parameterIndex => (dialect === 'postgres' ? `$${parameterIndex}` : '?'),
    limitAll: dialect === 'postgres' ? 'ALL' : '-1',
    trueLiteral: dialect === 'postgres' ? 'TRUE' : '1',
    falseLiteral: dialect === 'postgres' ? 'FALSE' : '0',
    jsonFieldText,
    jsonFieldValue,
    jsonArrayElements: expression =>
      dialect === 'postgres'
        ? { from: `jsonb_array_elements_text(${expression}) t`, value: 't' }
        : { from: `json_each(${expression})`, value: 'value' },
    jsonObject: entries =>
      dialect === 'postgres'
        ? `jsonb_build_object(${entries.join(', ')})`
        : `json_object(${entries.join(', ')})`,
    jsonAggregate: expression =>
      dialect === 'postgres'
        ? `COALESCE(jsonb_agg(${expression}), '[]'::jsonb)`
        : `COALESCE(json_group_array(json(json_quote(${expression}))), json('[]'))`,
    mergeJson: (left, right) =>
      dialect === 'postgres' ? `${left} || ${right}` : `json_patch(${left}, ${right})`
  };
};

export const entityQueryPlaceholder = (
  dialect: EntityQueryDialect,
  parameterIndex: number
): string => createEntityQueryDialectAdapter(dialect).placeholder(parameterIndex);
