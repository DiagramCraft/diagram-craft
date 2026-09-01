import type { PathStep } from '@arch-register/api-types/entityQueryIR';

/** A terse, human-readable rendering of a traversal `path` for read-only display while visual
 *  path editing is not yet wired (#2354, plan phase 5). Not a canonical text form - just enough
 *  to tell one saved traversal predicate from another. */
export const pathStepSummary = (path: PathStep[]): string =>
  path
    .map(step => {
      switch (step.kind) {
        case 'forward':
          return step.fieldId;
        case 'backward':
          return `<-${step.fieldId}`;
        case 'typedRelation':
          return `${step.direction === 'out' ? '->' : '<-'}${step.fieldId}`;
        case 'unboundTypedRelation':
          return `${step.direction === 'out' ? '->' : '<-'}${step.relationSchemaId}`;
        case 'endpoint':
          return `[${step.direction}]`;
        case 'relationForward':
          return step.fieldId;
        case 'relationBackward':
          return `<-${step.fieldId}`;
        default:
          return '?';
      }
    })
    .join('.');
