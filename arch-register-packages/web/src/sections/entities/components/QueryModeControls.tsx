import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { TbAlertTriangle, TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityQueryParseError } from '@arch-register/api-types/entityContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { SearchInput } from '../../../components/SearchInput';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { QueryBuilder } from './queryBuilder/QueryBuilder';
import { countConditions, isVisuallyEditable } from './queryBuilder/queryBuilderState';
import {
  buildEntityQueryFromBrowserFilters,
  stripEmptyGroups,
  withSchemaIdAsPredicate
} from './entityBrowserState';
import {
  useParseEntityQueryText,
  usePrintEntityQueryText
} from '../../../hooks/useEntityQueryText';
import styles from './EntityBrowser.module.css';

type Mode = 'simple' | 'advanced';

type QueryModeControlsProps = {
  workspaceId: string;
  q: string;
  setQ: (q: string) => void;
  conditions: FilterCondition[];
  setConditions: (conditions: FilterCondition[]) => void;
  // The Visual and Advanced modes both edit the same canonical EntityQuery. Surfaces that don't
  // track one yet (the markdown entity-browser embed, still flat-conditions-only) omit
  // `setEntityQuery` and fall back to a plain search box.
  entityQuery?: EntityQuery | null;
  setEntityQuery?: (query: EntityQuery | null) => void;
  typeFilter: string | null;
  joinAssessmentId?: string | null;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  joinedAssessment?: Assessment | null;
};

// The entity browser's query controls. The filter popover (the progressive `QueryBuilder`: flat
// conditions → Any/All groups → NOT → traversal) is available in BOTH modes. The Simple/Advanced
// toggle only changes the left-hand input: Simple shows the plain live search box (`q`, merged at
// execution via `withLiveSearchText`); Advanced replaces it with a text field bound to the same
// `EntityQuery` IR the builder edits. Both representations are full-fidelity, so nothing is lost
// switching. Surfaces without `setEntityQuery` (the markdown embed) fall back to the legacy flat
// `FilterBuilder` with no toggle.
export const QueryModeControls = (props: QueryModeControlsProps) => {
  const {
    workspaceId,
    q,
    setQ,
    conditions,
    setConditions,
    entityQuery,
    setEntityQuery,
    typeFilter,
    joinAssessmentId,
    schemas,
    lifecycleStates,
    owners,
    enums,
    joinedAssessment
  } = props;

  const filterPopoverRef = useRef<PopoverActions | null>(null);
  // The query both modes edit: an explicit `entityQuery` when one is set, otherwise derived from
  // the legacy `conditions`/`type` browser state (back-compat for old links and saved views). The
  // live search box's `q` stays out of it - it's merged in at execution via `withLiveSearchText`.
  const canonical = useMemo(
    (): EntityQuery =>
      entityQuery ??
      buildEntityQueryFromBrowserFilters({ typeFilter, conditions, joinAssessmentId, q: '' }),
    [entityQuery, typeFilter, conditions, joinAssessmentId]
  );

  const [mode, setMode] = useState<Mode>(() =>
    entityQuery && !isVisuallyEditable(entityQuery) ? 'advanced' : 'simple'
  );
  // Keep a query the visual builder can't fully edit yet (relation traversal, relationExists,
  // projections) in Advanced mode so it stays editable - mirrors the pre-existing "force advanced
  // for non-representable" behaviour, just with a wider "editable" bar. Never forces the reverse.
  useEffect(() => {
    if (entityQuery && !isVisuallyEditable(entityQuery)) setMode('advanced');
  }, [entityQuery]);

  const [advancedText, setAdvancedText] = useState('');
  const [advancedErrors, setAdvancedErrors] = useState<EntityQueryParseError[]>([]);
  const [textPreview, setTextPreview] = useState('');

  const parseText = useParseEntityQueryText(workspaceId);
  const printText = usePrintEntityQueryText(workspaceId);
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId, !!setEntityQuery);

  const printMutate = printText.mutateAsync;

  // Re-seed the Advanced text field whenever we (re)enter Advanced mode, or the canonical query
  // changes out from under it (a different saved/predefined view, a sidebar facet click). Advanced
  // mode only writes `entityQuery` on Enter/Clear, so this never fights the user's typing.
  useEffect(() => {
    if (mode !== 'advanced') return;
    let cancelled = false;
    printMutate(withSchemaIdAsPredicate(stripEmptyGroups(canonical))).then(res => {
      if (!cancelled) setAdvancedText(res.text);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, canonical, printMutate]);

  // Debounced text preview for Visual mode - a read-only "here's the query as text" line so the
  // grammar stays discoverable.
  useEffect(() => {
    if (mode !== 'simple' || !setEntityQuery) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      printMutate(withSchemaIdAsPredicate(stripEmptyGroups(canonical))).then(res => {
        if (!cancelled) setTextPreview(res.text);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mode, canonical, printMutate, setEntityQuery]);

  const submitAdvancedText = async (text: string) => {
    if (!text.trim()) {
      setAdvancedErrors([]);
      setEntityQuery?.({ root: { kind: 'and', children: [] } });
      return;
    }
    const result = await parseText.mutateAsync(text);
    if (result.ok) {
      setAdvancedErrors([]);
      setEntityQuery?.(result.query);
    } else {
      setAdvancedErrors(result.errors);
    }
  };

  const handleAdvancedKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    submitAdvancedText(advancedText);
  };

  const handleAdvancedClear = () => {
    setAdvancedText('');
    submitAdvancedText('');
  };

  const conditionCount = countConditions(canonical);

  const filterButton = (badgeCount: number) => (
    <Button
      size="sm"
      variant={badgeCount > 0 ? 'primary' : 'secondary'}
      icon={<TbFilter size={12} />}
      aria-label="Filter"
      title="Filter"
    >
      {badgeCount > 0 && <span className={styles.filterCount}>{badgeCount}</span>}
    </Button>
  );

  // Legacy fallback for surfaces that don't track a structured query (the markdown embed): the
  // flat FilterBuilder over `conditions`, no Simple/Advanced toggle.
  if (!setEntityQuery) {
    return (
      <>
        <SearchInput
          size="sm"
          className={styles.searchInline}
          placeholder="Search by name, owner…"
          value={q}
          onChange={setQ}
          onClear={() => setQ('')}
        />
        <Popover.Root actionsRef={filterPopoverRef}>
          <Popover.Trigger element={filterButton(conditions.length)} />
          <Popover.Content
            sideOffset={4}
            align="start"
            arrow={false}
            closeButton={false}
            className={styles.filterPopover}
          >
            <FilterBuilder
              conditions={conditions}
              onChange={setConditions}
              onClose={() => filterPopoverRef.current?.close()}
              schemas={schemas}
              lifecycleStates={lifecycleStates}
              owners={owners}
              enums={enums}
              selectedSchemaId={typeFilter}
              joinedAssessment={joinedAssessment}
              getFieldGroupAccess={getFieldGroupAccess}
            />
          </Popover.Content>
        </Popover.Root>
      </>
    );
  }

  return (
    <>
      {mode === 'simple' ? (
        <SearchInput
          size="sm"
          className={styles.searchInline}
          placeholder="Search by name, owner…"
          value={q}
          onChange={setQ}
          onClear={() => setQ('')}
        />
      ) : (
        <div className={styles.advancedQuery}>
          <SearchInput
            size="sm"
            className={styles.advancedSearchInput}
            value={advancedText}
            onChange={setAdvancedText}
            onKeyDown={handleAdvancedKeyDown}
            onClear={handleAdvancedClear}
          />
          {advancedErrors.length > 0 && (
            <div className={styles.advancedQueryError}>
              <TbAlertTriangle size={12} />
              <span>{advancedErrors[0]!.message}</span>
            </div>
          )}
        </div>
      )}

      <Popover.Root actionsRef={filterPopoverRef}>
        <Popover.Trigger element={filterButton(conditionCount)} />
        <Popover.Content
          sideOffset={4}
          align="start"
          arrow={false}
          closeButton={false}
          className={styles.filterPopover}
        >
          <QueryBuilder
            query={canonical}
            onChange={setEntityQuery}
            schemas={schemas}
            relationSchemas={relationSchemas}
            lifecycleStates={lifecycleStates}
            owners={owners}
            enums={enums}
            joinedAssessment={joinedAssessment}
            getFieldGroupAccess={getFieldGroupAccess}
            textPreview={mode === 'simple' ? textPreview : undefined}
            showFreeText={false}
            onClose={() => filterPopoverRef.current?.close()}
          />
        </Popover.Content>
      </Popover.Root>

      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (mode === 'simple') setEntityQuery(canonical);
          setMode(mode === 'simple' ? 'advanced' : 'simple');
        }}
        title={mode === 'simple' ? 'Switch to advanced query mode' : 'Switch to simple query mode'}
      >
        {mode === 'simple' ? 'Advanced' : 'Simple'}
      </Button>
    </>
  );
};
