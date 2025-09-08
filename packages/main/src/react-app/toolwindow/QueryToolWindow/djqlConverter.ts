import { ElementSearchClause } from '@diagram-craft/model/diagramElementSearch';

/**
 * Converts a simple text search query to DJQL format.
 * Simple searches look for nodes where the name contains the search text (case-insensitive).
 */
export const convertSimpleSearchToDJQL = (query: string): string => {
  if (!query.trim()) return '.elements[]';

  const escapedQuery = query.replace(/"/g, '\\"');
  return `.elements[]\n  | select(.type == "node")\n  | select(.name | test("${escapedQuery}"; "i"))`;
};

function convertClauses(parsedClauses: ElementSearchClause[]) {
  const filters: string[] = [];

  for (const clause of parsedClauses) {
    switch (clause.type) {
      case 'props':
        if (clause.relation === 'set') {
          filters.push(`select(.${clause.path} != null)`);
        } else {
          const value = clause.value;
          const path = clause.path;

          switch (clause.relation) {
            case 'eq': {
              if (isNaN(Number(value))) {
                filters.push(`select(.${path} == "${value}")`);
              } else {
                filters.push(`select(.${path} == ${value})`);
              }
              break;
            }
            case 'neq': {
              if (isNaN(Number(value))) {
                filters.push(`select(.${path} != "${value}")`);
              } else {
                filters.push(`select(.${path} != ${value})`);
              }
              break;
            }
            case 'gt':
              filters.push(`select(.${path} > ${value})`);
              break;
            case 'lt':
              filters.push(`select(.${path} < ${value})`);
              break;
            case 'contains': {
              const escapedValue = value.replace(/"/g, '\\"');
              filters.push(`select(.${path} | test("${escapedValue}"; "i"))`);
              break;
            }
            case 'matches': {
              const escapedRegex = value.replace(/"/g, '\\"');
              filters.push(`select(.${path} | test("${escapedRegex}"))`);
              break;
            }
          }
        }
        break;

      case 'tags':
        if (clause.tags && clause.tags.length > 0) {
          const tagsArray = JSON.stringify(clause.tags);
          filters.push(`select(.tags | contains(${tagsArray}))`);
        }
        break;

      case 'comment':
        if (clause.state) {
          filters.push(`select(any(.comments[]; .state == "${clause.state}"))`);
        } else {
          filters.push(`select(.comments | length > 0)`);
        }
        break;

      case 'any': {
        const sub = convertClauses(clause.clauses);
        const s: string[] = [];
        for (const c of sub) {
          s.push(`(. | ${c} | length > 0)`);
        }

        filters.push(`select([\n    ${s.join(',\n    ')}\n  ] | any)`);
        break;
      }
    }
  }
  return filters;
}

/**
 * Converts advanced search clauses (ElementSearchClause[]) to DJQL format.
 * Handles props, tags, comment, and any clause types with appropriate JQ syntax.
 */
export const convertAdvancedSearchToDJQL = (query: string): string => {
  if (!query.trim()) return '.elements[]';

  try {
    const parsedClauses = JSON.parse(query) as ElementSearchClause[];
    if (parsedClauses.length === 0) return '.elements[]';

    const filters = convertClauses(parsedClauses);

    return `.elements[]\n  | ${filters.join('\n  | ')}`;
  } catch {
    return '.elements[]';
  }
};
