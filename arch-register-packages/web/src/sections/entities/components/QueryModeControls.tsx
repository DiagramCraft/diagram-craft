import { useEffect, useMemo, useRef, useState } from 'react';
import { TbFilter } from 'react-icons/tb';
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
import { AdvancedQueryEditor } from './queryBuilder/AdvancedQueryEditor';
import { countConditions } from './queryBuilder/queryBuilderState';
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

// The entity browser's query controls: the live search box (`q`, merged at execution via
// `withLiveSearchText`), a Filter popover (the progressive `QueryBuilder`: flat conditions →
// Any/All groups → NOT → traversal) and an Advanced popover with a text field bound to the same
// `EntityQuery` IR the builder edits. Both representations are full-fidelity, so nothing is lost
// switching. Surfaces without `setEntityQuery` (the markdown embed) fall back to the legacy flat
// `FilterBuilder` with no Advanced popover.
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

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [advancedText, setAdvancedText] = useState('');
  const [advancedErrors, setAdvancedErrors] = useState<EntityQueryParseError[]>([]);

  const parseText = useParseEntityQueryText(workspaceId);
  const printText = usePrintEntityQueryText(workspaceId);
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId, !!setEntityQuery);

  const printMutate = printText.mutateAsync;

  // Re-seed the Advanced text field whenever the popover opens, or the canonical query changes
  // out from under it (a different saved/predefined view, a sidebar facet click). The Advanced
  // editor only writes `entityQuery` on Enter/Clear, so this never fights the user's typing.
  useEffect(() => {
    if (!advancedOpen) return;
    let cancelled = false;
    printMutate({
      query: withSchemaIdAsPredicate(stripEmptyGroups(canonical)),
      pretty: true
    }).then(res => {
      if (!cancelled) setAdvancedText(res.text);
    });
    return () => {
      cancelled = true;
    };
  }, [advancedOpen, canonical, printMutate]);

  // `parseText` returns projections for every representable `columns` clause. Only retain the
  // legacy projections that have no textual form (path-less columns); query-level path/aggregate
  // columns are always printed and must be removable when the user deletes them in Advanced mode.
  const withProjections = (query: EntityQuery): EntityQuery =>
    query.projections?.length ||
    !(canonical.projections ?? []).some(
      projection => !('kind' in projection) && projection.path.length === 0
    )
      ? query
      : {
          ...query,
          projections: canonical.projections?.filter(
            projection => !('kind' in projection) && projection.path.length === 0
          )
        };

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
    // Projections authored as `columns` clauses come back from `parseText`; `withProjections`
    // only re-applies legacy projections with no text form, so an edited query-level columns
    // clause wins and recursive/aggregate expressions can be removed normally.
    if (!text.trim()) {
      setAdvancedErrors([]);
      setEntityQuery?.(withProjections({ root: { kind: 'and', children: [] } }));
      return;
    }
    const result = await parseText.mutateAsync(text);
    if (result.ok) {
      setAdvancedErrors([]);
      setEntityQuery?.(withProjections(result.query));
    } else {
      setAdvancedErrors(result.errors);
    }
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
      <SearchInput
        size="sm"
        className={styles.searchInline}
        placeholder="Search by name, owner…"
        value={q}
        onChange={setQ}
        onClear={() => setQ('')}
      />

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
            showFreeText={false}
            onClose={() => filterPopoverRef.current?.close()}
          />
        </Popover.Content>
      </Popover.Root>

      <Popover.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Popover.Trigger
          element={
            <Button size="sm" variant="secondary" title="Edit the query as text">
              Advanced
            </Button>
          }
        />
        <Popover.Content
          sideOffset={4}
          align="start"
          arrow={false}
          closeButton={false}
          className={styles.filterPopover}
        >
          <div style={{ width: 480, maxWidth: '90vw', padding: 10 }}>
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
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
