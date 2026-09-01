import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TbAlertTriangle, TbFilter } from 'react-icons/tb';
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
import { SearchInput } from '../../components/SearchInput';
import { QueryBuilder } from '../entities/components/queryBuilder/QueryBuilder';
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
// Any/All groups → NOT) is available in both modes. The Simple/Advanced toggle only swaps the
// left-hand input: Simple has none (relations have no live free-text search), Advanced shows a
// text field bound to the same relation-rooted `EntityQuery` IR the builder edits. Both are
// full-fidelity, so nothing is lost switching. Relation-rooted traversal beyond one endpoint hop,
// and projection columns, keep the query in Advanced mode until those editors land (plan phase 7+).
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
    printMutate(relationQuery).then(res => {
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
      printMutate(relationQuery).then(res => {
        if (!cancelled) setTextPreview(res.text);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mode, relationQuery, printMutate]);

  const submitAdvancedText = async (text: string) => {
    if (!text.trim()) {
      setAdvancedErrors([]);
      emit({ root_kind: 'relation', root: { kind: 'and', children: [] } });
      return;
    }
    const result = await parseText.mutateAsync(text);
    if (result.ok) {
      setAdvancedErrors([]);
      emit(result.query);
    } else {
      setAdvancedErrors(result.errors);
    }
  };

  const handleAdvancedKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitAdvancedText(advancedText);
  };

  const handleAdvancedClear = () => {
    setAdvancedText('');
    submitAdvancedText('');
  };

  const conditionCount = countConditions(relationQuery);

  return (
    <>
      {mode === 'advanced' && (
        <div className={filterStyles.advancedQuery}>
          <SearchInput
            size="sm"
            className={filterStyles.advancedSearchInput}
            value={advancedText}
            onChange={setAdvancedText}
            onKeyDown={handleAdvancedKeyDown}
            onClear={handleAdvancedClear}
          />
          {advancedErrors.length > 0 && (
            <div className={filterStyles.advancedQueryError}>
              <TbAlertTriangle size={12} />
              <span>{advancedErrors[0]!.message}</span>
            </div>
          )}
        </div>
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
