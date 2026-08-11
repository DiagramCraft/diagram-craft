/**
 * Public façade for entity-query IR compilation.
 *
 * SQL generation lives in the staged renderer; keeping this module as the stable export surface
 * lets callers retain the existing compiler API while the internal pipeline evolves.
 */
export {
  compileEntityQueryIR,
  compileEntityQueryCountIR,
  compileEntityQueryPair,
  UnsupportedEntityQueryIRError
} from './entityQueryIRSqlRenderer';

export type {
  CompiledEntityQuery,
  CompiledEntityQueryOptions,
  EntityQueryCompilationPair,
  EntityQueryDialect
} from './entityQueryIRSqlRenderer';
