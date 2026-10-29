import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  getCategoricalFields,
  getNumericFields,
  type FieldOption,
  type JoinedAssessmentContext
} from './entityFieldSources';

type RowLike = { _schema: { id: string } };

/**
 * Field options for a chart axis over the current results: numeric and categorical fields unioned
 * across every schema present in `rows` (not schema-scoped).
 */
export const useAxisFieldOptions = (
  rows: RowLike[],
  joinedAssessment: JoinedAssessmentContext | null | undefined
) => {
  const { schemas, lifecycleStates, teams } = useWorkspaceContext();

  const rowSchemaIds = useMemo(() => [...new Set(rows.map(r => r._schema.id))], [rows]);
  const schemasInScope = useMemo(
    () => schemas.filter(s => rowSchemaIds.includes(s.id)),
    [schemas, rowSchemaIds]
  );
  const categoricalFields = useMemo(
    () => getCategoricalFields(schemasInScope, lifecycleStates, teams, joinedAssessment),
    [schemasInScope, lifecycleStates, teams, joinedAssessment]
  );
  const numericFields = useMemo(
    () => getNumericFields(schemasInScope, joinedAssessment),
    [schemasInScope, joinedAssessment]
  );
  const axisFieldOptions: FieldOption[] = useMemo(
    () => [...numericFields, ...categoricalFields],
    [numericFields, categoricalFields]
  );
  const isNumericField = useCallback(
    (fieldId: string) => numericFields.some(f => f.id === fieldId),
    [numericFields]
  );

  return {
    schemasInScope,
    categoricalFields,
    numericFields,
    axisFieldOptions,
    isNumericField,
    hasMixedSchemas: rowSchemaIds.length > 1
  };
};

/**
 * A stored or saved config can name fields that aren't axis options for the current results
 * (another schema, a renamed field). Native selects would then show their first option while the
 * view is built from unknown field ids and comes out empty, so unknown ids are swapped for
 * defaults in memory (nothing is written back until the user changes a setting).
 */
export const repairAxisPair = (
  options: FieldOption[],
  first: string,
  second: string
): [string, string] => {
  const ids = new Set(options.map(f => f.id));
  const nextFirst = ids.has(first) ? first : options[0]!.id;
  const nextSecond = ids.has(second)
    ? second
    : (options.find(f => f.id !== nextFirst) ?? options[0]!).id;
  return [nextFirst, nextSecond];
};

/** `id` when it is one of `options`, otherwise `null` (for optional size/color fields). */
export const keepKnownFieldId = (options: FieldOption[], id: string | null | undefined) =>
  id && options.some(f => f.id === id) ? id : null;

/**
 * Seeds a default config once. `setConfig` may write to the URL asynchronously, so without the
 * guard the effect re-fires on every render until the config round-trips, and each re-fire starts a
 * new navigation that can cancel the previous one - an endless render loop.
 */
export const useSeedDefaultConfig = (config: unknown, canSeed: boolean, seed: () => void) => {
  const seededRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `seed` is intentionally excluded; the guard prevents re-seeding
  useEffect(() => {
    if (config) {
      seededRef.current = false;
      return;
    }
    if (!canSeed || seededRef.current) return;
    seededRef.current = true;
    seed();
  }, [config, canSeed]);
};
