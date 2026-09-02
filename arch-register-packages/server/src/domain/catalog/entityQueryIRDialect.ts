export type EntityQueryDialect = 'postgres' | 'sqlite';

export type EntityQueryDialectArrayElement = {
  joinClause: string;
  valueColumn: string;
  ordinalColumn: string;
};

/** Dialect-specific tokens used by the logical query-plan renderer. */
export type EntityQueryDialectAdapter = {
  placeholder: (parameterIndex: number) => string;
  limitAll: string;
  trueLiteral: string;
  falseLiteral: string;
  jsonFieldText: (expression: string, fieldId: string) => string;
  jsonFieldValue: (expression: string, fieldId: string) => string;
  jsonPathText: (expression: string, path: readonly string[]) => string;
  jsonPathValue: (expression: string, path: readonly string[]) => string;
  jsonArrayElements: (expression: string) => { from: string; value: string };
  jsonArrayContains: (ownerAlias: string, fieldId: string, targetAlias: string) => string;
  jsonArrayElementPosition: (ownerAlias: string, fieldId: string, targetId: string) => string;
  jsonArrayLateralElement: (
    ownerAlias: string,
    fieldId: string,
    elementAlias: string
  ) => EntityQueryDialectArrayElement;
  jsonObject: (entries: string[]) => string;
  jsonArray: (entries: string[]) => string;
  toJson: (expression: string) => string;
  wrapJson: (expression: string) => string;
  orderedJsonAggregate: (
    value: string,
    source: string,
    orderBy: string,
    valueIsJson?: boolean
  ) => string;
  jsonAggregate: (expression: string) => string;
  mergeJson: (left: string, right: string) => string;
  emptyObject: string;
  emptyArray: string;
  nullJson: string;
  textCast: (expression: string) => string;
  uuidFromText: (expression: string) => string;
  stateText: (stateColumn: string, fieldId: string) => string;
  stateValue: (stateColumn: string, fieldId: string) => string;
  nowTimestamp: string;
  dateTime: (expression: string) => string;
  conformanceStaleThreshold: (oldestEvaluatedAt: string) => string;
  conformanceUpdatedAfterEvaluation: (updatedAt: string, lastEvaluatedAt: string) => string;
  initialEventNumber: string;
  liveEntityState: (alias: string) => string;
  liveRelationState: (alias: string) => string;
  /**
   * A raw, dialect-specific SQL expression for "today, UTC, as yyyy-mm-dd text" (optionally offset
   * by `offsetDays`), matching the format date fields are stored/compared in as JSON text. Used to
   * render the `{ $now, offsetDays }` filter-value marker instead of a bound parameter.
   */
  nowDateLiteral: (offsetDays?: number) => string;
};

const assertSafeJsonFieldId = (fieldId: string): void => {
  if (!/^[a-zA-Z0-9_-]+$/.test(fieldId)) {
    throw new Error(`Invalid field id '${fieldId}'`);
  }
};

export const createEntityQueryDialectAdapter = (
  dialect: EntityQueryDialect
): EntityQueryDialectAdapter => {
  const jsonPath = (path: readonly string[]): string => {
    path.forEach(assertSafeJsonFieldId);
    return path.join('.');
  };

  const jsonPathText = (expression: string, path: readonly string[]): string => {
    if (path.length === 0) return expression;
    path.forEach(assertSafeJsonFieldId);
    if (dialect === 'postgres') {
      const operators = path
        .slice(0, -1)
        .map(fieldId => `->'${fieldId}'`)
        .join('');
      return `${expression}${operators}->>'${path[path.length - 1]}'`;
    }
    return `json_extract(${expression}, '$.${jsonPath(path)}')`;
  };

  const jsonPathValue = (expression: string, path: readonly string[]): string => {
    if (path.length === 0) return expression;
    path.forEach(assertSafeJsonFieldId);
    if (dialect === 'postgres') {
      return `${expression}${path.map(fieldId => `->'${fieldId}'`).join('')}`;
    }
    return `json_extract(${expression}, '$.${jsonPath(path)}')`;
  };

  const jsonFieldText = (expression: string, fieldId: string): string => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? `(${jsonPathText(expression, [fieldId])})`
      : `json_extract(${expression}, '$.${fieldId}')`;
  };

  const jsonFieldValue = (expression: string, fieldId: string): string => {
    assertSafeJsonFieldId(fieldId);
    return jsonPathValue(expression, [fieldId]);
  };

  const jsonArrayContains = (ownerAlias: string, fieldId: string, targetAlias: string): string => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? `EXISTS (SELECT 1 FROM jsonb_array_elements_text(${ownerAlias}.data->'${fieldId}') t WHERE t = ${targetAlias}.id::text)`
      : `EXISTS (SELECT 1 FROM json_each(${ownerAlias}.data, '$.${fieldId}') WHERE value = ${targetAlias}.id)`;
  };

  const jsonArrayElementPosition = (
    ownerAlias: string,
    fieldId: string,
    targetId: string
  ): string => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? `(SELECT array_item.ordinal FROM jsonb_array_elements_text(${ownerAlias}.data->'${fieldId}') WITH ORDINALITY AS array_item(value, ordinal) WHERE array_item.value = ${targetId}::text LIMIT 1)`
      : `(SELECT array_item.key FROM json_each(${ownerAlias}.data, '$.${fieldId}') AS array_item WHERE array_item.value = ${targetId} LIMIT 1)`;
  };

  const jsonArrayLateralElement = (
    ownerAlias: string,
    fieldId: string,
    elementAlias: string
  ): EntityQueryDialectArrayElement => {
    assertSafeJsonFieldId(fieldId);
    return dialect === 'postgres'
      ? {
          joinClause: `JOIN LATERAL jsonb_array_elements_text(${ownerAlias}.data->'${fieldId}') WITH ORDINALITY AS ${elementAlias}(value, ordinal) ON TRUE`,
          valueColumn: `${elementAlias}.value::uuid`,
          ordinalColumn: `${elementAlias}.ordinal`
        }
      : {
          joinClause: `JOIN json_each(${ownerAlias}.data, '$.${fieldId}') AS ${elementAlias}`,
          valueColumn: `${elementAlias}.value`,
          ordinalColumn: `${elementAlias}.key`
        };
  };

  const toJson = (expression: string): string =>
    dialect === 'postgres' ? `to_jsonb(${expression})` : expression;
  const wrapJson = (expression: string): string =>
    dialect === 'postgres' ? expression : `json(${expression})`;
  const orderedJsonAggregate = (
    value: string,
    source: string,
    orderBy: string,
    valueIsJson = false
  ): string => {
    const orderedRows = `(SELECT ${value} AS ordered_value ${source} ORDER BY ${orderBy})`;
    if (dialect === 'postgres') {
      return `COALESCE((SELECT jsonb_agg(ordered_value) FROM ${orderedRows} AS ordered_values), '[]'::jsonb)`;
    }
    const sqliteValue = valueIsJson ? 'json(ordered_value)' : 'json(json_quote(ordered_value))';
    return `COALESCE((SELECT json_group_array(${sqliteValue}) FROM ${orderedRows} AS ordered_values), json('[]'))`;
  };

  const stateText = (stateColumn: string, fieldId: string): string => {
    const value = jsonPathText(stateColumn, [fieldId]);
    return fieldId === 'project_id' ? uuidFromText(value) : value;
  };
  const stateValue = (stateColumn: string, fieldId: string): string =>
    jsonPathValue(stateColumn, [fieldId]);
  const uuidFromText = (expression: string): string =>
    dialect === 'postgres' ? `NULLIF(${expression}, '')::uuid` : expression;

  const liveEntityState = (alias: string): string =>
    dialect === 'postgres'
      ? `jsonb_build_object(
        'id', ${alias}.id,
        'public_id', ${alias}.public_id,
        'slug', ${alias}.slug,
        'namespace', ${alias}.namespace,
        'name', ${alias}.name,
        'description', ${alias}.description,
        'owner', ${alias}.owner,
        'lifecycle', ${alias}.lifecycle,
        'target_lifecycle', ${alias}.target_lifecycle,
        'target_lifecycle_date', ${alias}.target_lifecycle_date,
        'tags', ${alias}.tags,
        'links', ${alias}.links,
        'schema_id', ${alias}.schema_id,
        'data', ${alias}.data,
        'project_id', ${alias}.project_id,
        'version', ${alias}.version,
        'completeness', ${alias}.completeness,
        'created_at', ${alias}.created_at,
        'updated_at', ${alias}.updated_at
      )`
      : `json_object(
        'id', ${alias}.id,
        'public_id', ${alias}.public_id,
        'slug', ${alias}.slug,
        'namespace', ${alias}.namespace,
        'name', ${alias}.name,
        'description', ${alias}.description,
        'owner', ${alias}.owner,
        'lifecycle', ${alias}.lifecycle,
        'target_lifecycle', ${alias}.target_lifecycle,
        'target_lifecycle_date', ${alias}.target_lifecycle_date,
        'tags', json(${alias}.tags),
        'links', json(${alias}.links),
        'schema_id', ${alias}.schema_id,
        'data', json(${alias}.data),
        'project_id', ${alias}.project_id,
        'version', ${alias}.version,
        'completeness', ${alias}.completeness,
        'created_at', ${alias}.created_at,
        'updated_at', ${alias}.updated_at
      )`;

  const liveRelationState = (alias: string): string =>
    dialect === 'postgres'
      ? `jsonb_build_object(
        'id', ${alias}.id,
        'workspace', ${alias}.workspace,
        'schema_id', ${alias}.schema_id,
        'in_entity_id', ${alias}.in_record_id,
        'out_entity_id', ${alias}.out_record_id,
        'data', ${alias}.data,
        'owner', ${alias}.owner,
        'lifecycle', ${alias}.lifecycle,
        'version', ${alias}.version,
        'approval_policy_override', ${alias}.approval_policy_override,
        'created_at', ${alias}.created_at,
        'updated_at', ${alias}.updated_at
      )`
      : `json_object(
        'id', ${alias}.id,
        'workspace', ${alias}.workspace,
        'schema_id', ${alias}.schema_id,
        'in_entity_id', ${alias}.in_record_id,
        'out_entity_id', ${alias}.out_record_id,
        'data', json(${alias}.data),
        'owner', ${alias}.owner,
        'lifecycle', ${alias}.lifecycle,
        'version', ${alias}.version,
        'approval_policy_override', ${alias}.approval_policy_override,
        'created_at', ${alias}.created_at,
        'updated_at', ${alias}.updated_at
      )`;

  return {
    placeholder: parameterIndex => (dialect === 'postgres' ? `$${parameterIndex}` : '?'),
    limitAll: dialect === 'postgres' ? 'ALL' : '-1',
    trueLiteral: dialect === 'postgres' ? 'TRUE' : '1',
    falseLiteral: dialect === 'postgres' ? 'FALSE' : '0',
    jsonFieldText,
    jsonFieldValue,
    jsonPathText,
    jsonPathValue,
    jsonArrayElements: expression =>
      dialect === 'postgres'
        ? { from: `jsonb_array_elements_text(${expression}) t`, value: 't' }
        : { from: `json_each(${expression})`, value: 'value' },
    jsonArrayContains,
    jsonArrayElementPosition,
    jsonArrayLateralElement,
    jsonObject: entries =>
      dialect === 'postgres'
        ? `jsonb_build_object(${entries.join(', ')})`
        : `json_object(${entries.join(', ')})`,
    jsonArray: entries =>
      dialect === 'postgres'
        ? `jsonb_build_array(${entries.join(', ')})`
        : `json_array(${entries.join(', ')})`,
    toJson,
    wrapJson,
    orderedJsonAggregate,
    jsonAggregate: expression =>
      dialect === 'postgres'
        ? `COALESCE(jsonb_agg(${expression}), '[]'::jsonb)`
        : `COALESCE(json_group_array(json(json_quote(${expression}))), json('[]'))`,
    mergeJson: (left, right) =>
      dialect === 'postgres' ? `${left} || ${right}` : `json_patch(${left}, ${right})`,
    emptyObject: dialect === 'postgres' ? "'{}'::jsonb" : "'{}'",
    emptyArray: dialect === 'postgres' ? "'[]'::jsonb" : "'[]'",
    nullJson: dialect === 'postgres' ? 'NULL::jsonb' : 'NULL',
    textCast: expression => (dialect === 'postgres' ? `${expression}::text` : expression),
    uuidFromText,
    stateText,
    stateValue,
    nowTimestamp: dialect === 'postgres' ? 'NOW()' : "datetime('now')",
    dateTime: expression => (dialect === 'postgres' ? expression : `datetime(${expression})`),
    conformanceStaleThreshold: oldestEvaluatedAt =>
      dialect === 'postgres'
        ? `${oldestEvaluatedAt} < CURRENT_TIMESTAMP - INTERVAL '24 hours'`
        : `datetime(${oldestEvaluatedAt}) < datetime('now', '-24 hours')`,
    conformanceUpdatedAfterEvaluation: (updatedAt, lastEvaluatedAt) =>
      dialect === 'postgres'
        ? `${updatedAt} > ${lastEvaluatedAt}`
        : `datetime(${updatedAt}) > datetime(${lastEvaluatedAt})`,
    initialEventNumber: dialect === 'postgres' ? '0::bigint' : '0',
    liveEntityState,
    liveRelationState,
    nowDateLiteral: offsetDays => {
      const n = Number.isInteger(offsetDays) ? (offsetDays as number) : 0;
      if (dialect === 'postgres') {
        return n === 0
          ? `to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`
          : `to_char((NOW() AT TIME ZONE 'UTC')::date + INTERVAL '${n} days', 'YYYY-MM-DD')`;
      }
      return n === 0 ? `date('now')` : `date('now', '${n >= 0 ? '+' : ''}${n} days')`;
    }
  };
};

export const entityQueryPlaceholder = (
  dialect: EntityQueryDialect,
  parameterIndex: number
): string => createEntityQueryDialectAdapter(dialect).placeholder(parameterIndex);
