// Best-effort, display-only pretty-printer for the SQL entityQueryIRCompiler.ts produces — purely
// a readability aid for printEntityQuerySql.ts; never used on SQL that's actually executed (that
// SQL's whitespace doesn't matter to any driver). Deliberately not a general SQL formatter: it
// leans on this codebase's own compiler always emitting ` AND `/` OR ` with single surrounding
// spaces and never nesting quoted string literals containing those tokens, which holds for
// generated SQL but would not hold for arbitrary hand-written SQL.

const flattenWhitespace = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

// Finds the outer (paren-depth 0) `WHERE` — the CTE in entityQueryIRCompiler.ts's output has its
// own nested `WHERE` inside the CTE's enclosing parens, which a plain `indexOf('WHERE')` would
// find first and mis-split on.
const findTopLevelWhereIndex = (sql: string): number => {
  let depth = 0;
  const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && sql.startsWith('WHERE', i)) {
      if (!isWordChar(sql[i - 1]) && !isWordChar(sql[i + 5])) return i;
    }
  }
  return -1;
};

// Re-indents a boolean expression by paren depth, breaking a new line at each `(`, before each
// matching `)`, and at each top-level-for-its-depth ` AND `/` OR `. Nested EXISTS/scalar
// subqueries (and their own inner `WHERE`s) fall out naturally, since they're just more `(`/`)`.
const indentExpression = (expr: string, baseIndent: string, indentUnit = '  '): string => {
  const flat = flattenWhitespace(expr);
  let depth = 0;
  let out = '';
  let i = 0;
  const newline = () => `\n${baseIndent}${indentUnit.repeat(depth)}`;

  while (i < flat.length) {
    if (flat.startsWith(' AND ', i)) {
      out += `${newline()}AND `;
      i += 5;
      continue;
    }
    if (flat.startsWith(' OR ', i)) {
      out += `${newline()}OR `;
      i += 4;
      continue;
    }
    const ch = flat[i]!;
    if (ch === '(') {
      depth++;
      out += `(${newline()}`;
      i++;
      if (flat[i] === ' ') i++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(depth - 1, 0);
      out = out.replace(/ +$/, '');
      out += `${newline()})`;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
};

// Re-indents just the WHERE clause of a compiled EntityQuery SQL statement; the WITH/SELECT/
// FROM/JOIN skeleton around it is already reasonably laid out by the compiler's own template.
export const formatCompiledSqlForDisplay = (sql: string): string => {
  const whereIndex = findTopLevelWhereIndex(sql);
  if (whereIndex === -1) return sql.trim();

  const before = sql.slice(0, whereIndex).trim();
  const afterWhere = sql.slice(whereIndex + 'WHERE'.length);
  const orderByMatch = afterWhere.match(/\bORDER BY\b[\s\S]*$/);
  const whereBody = orderByMatch ? afterWhere.slice(0, orderByMatch.index) : afterWhere;
  const orderBySuffix = orderByMatch ? `\n${flattenWhitespace(orderByMatch[0])}` : '';

  return `${before}\nWHERE\n  ${indentExpression(whereBody, '  ').trimStart()}${orderBySuffix}`;
};
