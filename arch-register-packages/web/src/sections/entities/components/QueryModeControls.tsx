import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TbAlertTriangle, TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
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
import { FilterBuilder } from '../../../components/FilterBuilder';
import { SearchInput } from '../../../components/SearchInput';
import {
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  isBasicRepresentable,
  withSchemaIdAsPredicate
} from './entityBrowserState';
import {
  useParseEntityQueryText,
  usePrintEntityQueryText
} from '../../../hooks/useEntityQueryText';
import styles from './EntityBrowser.module.css';

type Mode = 'basic' | 'advanced';

type QueryModeControlsProps = {
  workspaceId: string;
  q: string;
  setQ: (q: string) => void;
  conditions: FilterCondition[];
  setConditions: (conditions: FilterCondition[]) => void;
  // Advanced mode needs somewhere to persist the canonical EntityQuery it parses to — surfaces
  // that don't track one yet (e.g. the markdown entity-browser embed, still flat-conditions-only)
  // omit `setEntityQuery` and get Basic mode only, no toggle.
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

// The Basic ⇄ Advanced toggle over the entity browser's search/filter controls. Basic mode is
// unchanged (free-text box + FilterBuilder popover); Advanced mode is a single text field that
// parses directly to/from EntityQuery (specs/QUERY_LANGUAGE.md §4) via the entityQueryText
// endpoints. The underlying query — whichever mode produced it — always lives in the same
// `entityQuery`/`conditions`+`q` browser state, so switching modes never loses the live result
// set; only Advanced → Basic can be lossy (grouping, NOT, traversal, relationExists,
// projections aren't representable flatly), which is why that direction confirms first.
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
  const [mode, setMode] = useState<Mode>(() =>
    entityQuery && !isBasicRepresentable(entityQuery) ? 'advanced' : 'basic'
  );
  const [advancedText, setAdvancedText] = useState('');
  const [advancedErrors, setAdvancedErrors] = useState<EntityQueryParseError[]>([]);
  const [pendingSwitch, setPendingSwitch] = useState(false);

  const parseText = useParseEntityQueryText(workspaceId);
  const printText = usePrintEntityQueryText(workspaceId);

  const canonicalQuery = (): EntityQuery =>
    entityQuery ??
    buildEntityQueryFromBrowserFilters({ typeFilter, conditions, joinAssessmentId, q });

  // Re-seed the Advanced text field whenever we (re)enter Advanced mode, or whatever
  // `canonicalQuery()` would resolve to changes out from under it — e.g. the user picks a
  // different saved/predefined view, or a sidebar type/status/owner facet (which resets
  // `entityQuery` to null and re-derives from `typeFilter`/`conditions` instead — a second facet
  // click keeps `entityQuery` at that same null, so `entityQuery` alone isn't enough to notice the
  // change; every input the fallback reads has to be a dependency too, spelled out inline below
  // rather than behind the `canonicalQuery()` closure so the exhaustive-deps check can see them).
  // Safe to depend on all of these (unlike a plain keystroke-driven update, which would fight the
  // user's typing): Advanced mode only writes `entityQuery` on Enter/Clear now, never per
  // keystroke, and `typeFilter`/`conditions`/`q` don't change from Advanced-mode typing at all —
  // only from outside navigation.
  useEffect(() => {
    if (mode !== 'advanced') return;
    let cancelled = false;
    const query =
      entityQuery ??
      buildEntityQueryFromBrowserFilters({ typeFilter, conditions, joinAssessmentId, q });
    printText.mutateAsync(withSchemaIdAsPredicate(query)).then(res => {
      if (!cancelled) setAdvancedText(res.text);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, entityQuery, typeFilter, conditions, q, joinAssessmentId, printText.mutateAsync]);

  // Advanced mode only re-runs the search on Enter (or Clear), not per keystroke — parsing hits
  // the server, and re-parsing/re-filtering on every character would be both wasteful and jumpy
  // to read while still typing a multi-clause query.
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

  const applyBasicConversion = (query: EntityQuery) => {
    const converted = entityQueryToBrowserFilters(query);
    setConditions(converted.conditions);
    setQ(converted.q);
    setMode('basic');
    setAdvancedErrors([]);
  };

  const switchToAdvanced = () => {
    setEntityQuery?.(canonicalQuery());
    setMode('advanced');
  };

  const switchToBasic = () => {
    const query = canonicalQuery();
    if (isBasicRepresentable(query)) applyBasicConversion(query);
    else setPendingSwitch(true);
  };

  return (
    <>
      {mode === 'basic' ? (
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
            <Popover.Trigger
              element={
                <Button
                  size="sm"
                  variant={conditions.length > 0 ? 'primary' : 'secondary'}
                  icon={<TbFilter size={12} />}
                  aria-label="Filter"
                  title="Filter"
                >
                  {conditions.length > 0 && (
                    <span className={styles.filterCount}>{conditions.length}</span>
                  )}
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
              />
            </Popover.Content>
          </Popover.Root>
        </>
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

      {setEntityQuery && (
        <Button
          size="sm"
          variant="secondary"
          onClick={mode === 'basic' ? switchToAdvanced : switchToBasic}
          title={mode === 'basic' ? 'Switch to advanced query mode' : 'Switch to basic query mode'}
        >
          {mode === 'basic' ? 'Advanced' : 'Basic'}
        </Button>
      )}

      <Dialog
        open={pendingSwitch}
        onClose={() => setPendingSwitch(false)}
        title="Switch to Basic mode?"
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setPendingSwitch(false) },
          {
            label: 'Switch to Basic',
            type: 'default',
            onClick: () => {
              applyBasicConversion(canonicalQuery());
              setPendingSwitch(false);
            }
          }
        ]}
      >
        <p>
          This query uses grouping, NOT, or relation traversal that Basic mode can&apos;t represent.
          Switching will keep only the parts Basic mode supports and drop the rest.
        </p>
      </Dialog>
    </>
  );
};
