import { useEffect, useRef, useState } from 'react';
import { TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityQueryParseError } from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { QueryBuilder } from '../entities/components/queryBuilder/QueryBuilder';
import { AdvancedQueryEditor } from '../entities/components/queryBuilder/AdvancedQueryEditor';
import {
  countConditions,
  isVisuallyEditable
} from '../entities/components/queryBuilder/queryBuilderState';
import { useParseEntityQueryText, usePrintEntityQueryText } from '../../hooks/useEntityQueryText';
import filterStyles from '../entities/components/EntityBrowser.module.css';

type Mode = 'simple' | 'advanced';

type RelationQueryModeControlsProps = {
  workspaceId: string;
  // The relation-rooted query as stored (URL search param / saved view). Always a valid relation
  // EntityQuery - `useRelationBrowserData` rebuilds an empty `and` when nothing is set.
  relationQuery: EntityQuery;
  setRelationQuery: (query: EntityQuery | null) => void;
  relationSchemas: RelationSchema[];
  entitySchemas: EntitySchema[];
  enums: WorkspaceEnum[];
  owners: WorkspaceOwnerOption[];
  lifecycleStates: WorkspaceLifecycleState[];
};

// The Relations browser's query controls, mirroring the entity browser's QueryModeControls: the
// progressive `QueryBuilder` (rootKind="relation" - flat relation / In-Out endpoint conditions →
// Any/All groups → NOT → relationForward/relationBackward traversal and projection columns, #3120)
// is available in both modes. The Simple/Advanced toggle only swaps the left-hand input: Simple has
// none (relations have no live free-text search), Advanced shows a text field bound to the same
// relation-rooted `EntityQuery` IR the builder edits. Both are full-fidelity, so nothing is lost
// switching. A scoped `[...]` filter on a relation-context hop, or a `source: 'relation'`
// projection, still keeps the query in Advanced mode - those editors haven't landed yet.
export const RelationQueryModeControls = ({
  workspaceId,
  relationQuery,
  setRelationQuery,
  relationSchemas,
  entitySchemas,
  enums,
  owners,
  lifecycleStates
}: RelationQueryModeControlsProps) => {
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const [mode, setMode] = useState<Mode>(() =>
    isVisuallyEditable(relationQuery) ? 'simple' : 'advanced'
  );
  useEffect(() => {
    if (!isVisuallyEditable(relationQuery)) setMode('advanced');
  }, [relationQuery]);

  const [advancedText, setAdvancedText] = useState('');
  const [advancedErrors, setAdvancedErrors] = useState<EntityQueryParseError[]>([]);
  const [textPreview, setTextPreview] = useState('');

  const parseText = useParseEntityQueryText(workspaceId);
  const printText = usePrintEntityQueryText(workspaceId);
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const printMutate = printText.mutateAsync;

  const emit = (query: EntityQuery | null) =>
    setRelationQuery(query ? { ...query, root_kind: 'relation' } : null);

  // Re-seed the Advanced text field on (re)entering Advanced mode or when the query changes out
  // from under it (a different saved view).
  useEffect(() => {
    if (mode !== 'advanced') return;
    let cancelled = false;
    printMutate({ query: relationQuery, pretty: true }).then(res => {
      if (!cancelled) setAdvancedText(res.text);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, relationQuery, printMutate]);

  // Debounced read-only text preview for Simple mode.
  useEffect(() => {
    if (mode !== 'simple') return;
    let cancelled = false;
    const handle = setTimeout(() => {
      printMutate({ query: relationQuery, pretty: true }).then(res => {
        if (!cancelled) setTextPreview(res.text);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mode, relationQuery, printMutate]);

  // `parseText` returns `projections` for `columns` clauses in the text (specs/QUERY_LANGUAGE.md
  // §4.6); trust those and only fall back to the pre-edit set when the text expressed none (§10).
  const withProjections = (query: EntityQuery): EntityQuery =>
    query.projections?.length || !relationQuery.projections?.length
      ? query
      : { ...query, projections: relationQuery.projections };

  const formatAdvancedText = async () => {
    if (!advancedText.trim()) {
      setAdvancedErrors([]);
      return;
    }
    const result = await parseText.mutateAsync(advancedText);
    if (!result.ok) {
      setAdvancedErrors(result.errors);
      return;
    }
    const formatted = await printMutate({
      query: withProjections(result.query),
      pretty: true
    });
    setAdvancedErrors([]);
    setAdvancedText(formatted.text);
  };

  const submitAdvancedText = async (text: string) => {
    // `columns` clauses in the text round-trip through `parseText`; `withProjections` only
    // re-applies the pre-edit projections when the text expressed none (specs/QUERY_LANGUAGE.md §10).
    if (!text.trim()) {
      setAdvancedErrors([]);
      emit(withProjections({ root_kind: 'relation', root: { kind: 'and', children: [] } }));
      return;
    }
    const result = await parseText.mutateAsync(text);
    if (result.ok) {
      setAdvancedErrors([]);
      emit(withProjections(result.query));
    } else {
      setAdvancedErrors(result.errors);
    }
  };

  const handleAdvancedClear = () => {
    setAdvancedText('');
    submitAdvancedText('');
  };

  const conditionCount = countConditions(relationQuery);

  return (
    <>
      {mode === 'advanced' && (
        <AdvancedQueryEditor
          value={advancedText}
          onChange={value => {
            setAdvancedText(value);
            if (advancedErrors.length > 0) setAdvancedErrors([]);
          }}
          onSubmit={() => void submitAdvancedText(advancedText)}
          onFormat={() => void formatAdvancedText()}
          onClear={handleAdvancedClear}
          error={advancedErrors[0]?.message}
          formatPending={parseText.isPending || printText.isPending}
        />
      )}

      <Popover.Root actionsRef={filterPopoverRef}>
        <Popover.Trigger
          element={
            <Button
              size="sm"
              variant={conditionCount > 0 ? 'primary' : 'secondary'}
              icon={<TbFilter size={12} />}
              aria-label="Filter"
              title="Filter"
            >
              {conditionCount > 0 && (
                <span className={filterStyles.filterCount}>{conditionCount}</span>
              )}
            </Button>
          }
        />
        <Popover.Content
          sideOffset={4}
          align="start"
          arrow={false}
          closeButton={false}
          className={filterStyles.filterPopover}
        >
          <QueryBuilder
            rootKind="relation"
            query={relationQuery}
            onChange={emit}
            schemas={entitySchemas}
            relationSchemas={relationSchemas}
            lifecycleStates={lifecycleStates}
            owners={owners}
            enums={enums}
            getFieldGroupAccess={getFieldGroupAccess}
            showFreeText={false}
            textPreview={mode === 'simple' ? textPreview : undefined}
            onClose={() => filterPopoverRef.current?.close()}
          />
        </Popover.Content>
      </Popover.Root>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => setMode(mode === 'simple' ? 'advanced' : 'simple')}
        title={mode === 'simple' ? 'Switch to advanced query mode' : 'Switch to simple query mode'}
      >
        {mode === 'simple' ? 'Advanced' : 'Simple'}
      </Button>
    </>
  );
};
