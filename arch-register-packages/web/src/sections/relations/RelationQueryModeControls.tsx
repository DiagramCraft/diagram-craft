import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TbAlertTriangle, TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityQueryParseError } from '@arch-register/api-types/entityContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { RelationFilterBuilder } from './RelationFilterBuilder';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { SearchInput } from '../../components/SearchInput';
import { useParseEntityQueryText, usePrintEntityQueryText } from '../../hooks/useEntityQueryText';
import filterStyles from '../entities/components/EntityBrowser.module.css';

type Mode = 'basic' | 'advanced';

type RelationQueryModeControlsProps = {
  workspaceId: string;
  conditions: FilterCondition[];
  setConditions: (conditions: FilterCondition[]) => void;
  relationQuery: EntityQuery;
  setRelationQuery: (query: EntityQuery | null) => void;
  representable: boolean;
  relationSchemas: RelationSchema[];
  entitySchemas: EntitySchema[];
  enums: WorkspaceEnum[];
  owners: WorkspaceOwnerOption[];
  lifecycleStates: WorkspaceLifecycleState[];
};

// The Relations browser's Basic ⇄ Advanced toggle (#3066), mirroring the entity browser's
// QueryModeControls.tsx: Basic mode is the unchanged flat condition-row FilterBuilder popover;
// Advanced mode is a single text field that parses/prints directly to/from the relation-rooted
// EntityQuery via the same entityQueryText endpoints entities use (they resolve against the whole
// workspace catalog — entity and relation schemas alike — so no relation-specific server work was
// needed). A saved view whose query isn't Basic-representable (an `or` root, a `relationForward`
// traversal, or a projection — see isRelationBasicRepresentable) opens directly in Advanced mode,
// since Basic mode would otherwise silently drop the parts it can't express.
export const RelationQueryModeControls = ({
  workspaceId,
  conditions,
  setConditions,
  relationQuery,
  setRelationQuery,
  representable,
  relationSchemas,
  entitySchemas,
  enums,
  owners,
  lifecycleStates
}: RelationQueryModeControlsProps) => {
  const filterPopoverRef = useRef<PopoverActions | null>(null);
  const [mode, setMode] = useState<Mode>(() => (representable ? 'basic' : 'advanced'));
  // The mount-time initializer above only fires once — this keeps the mode in sync when a newly
  // selected saved view's query isn't Basic-representable (an `or` root, a `relationForward`
  // step, or a projection) while a previously-selected representable view left mode at 'basic',
  // so its filter isn't silently under-displayed/dropped by a Basic mode that can't express it.
  // Never forces the reverse: once representable, the user's own Basic/Advanced choice persists.
  useEffect(() => {
    if (!representable) setMode('advanced');
  }, [representable]);
  const [advancedText, setAdvancedText] = useState('');
  const [advancedErrors, setAdvancedErrors] = useState<EntityQueryParseError[]>([]);
  const [pendingSwitch, setPendingSwitch] = useState(false);

  const parseText = useParseEntityQueryText(workspaceId);
  const printText = usePrintEntityQueryText(workspaceId);
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);

  // Re-seed the Advanced text field whenever we (re)enter Advanced mode or the underlying query
  // changes out from under it (e.g. a different saved view is selected).
  useEffect(() => {
    if (mode !== 'advanced') return;
    let cancelled = false;
    printText.mutateAsync(relationQuery).then(res => {
      if (!cancelled) setAdvancedText(res.text);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, relationQuery, printText.mutateAsync]);

  // Only re-parses on Enter/Clear, not per keystroke.
  const submitAdvancedText = async (text: string) => {
    if (!text.trim()) {
      setAdvancedErrors([]);
      setRelationQuery({ root_kind: 'relation', root: { kind: 'and', children: [] } });
      return;
    }
    const result = await parseText.mutateAsync(text);
    if (result.ok) {
      setAdvancedErrors([]);
      setRelationQuery({ ...result.query, root_kind: 'relation' });
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

  const applyBasicConversion = () => {
    setConditions(conditions);
    setMode('basic');
    setAdvancedErrors([]);
  };

  const switchToAdvanced = () => setMode('advanced');

  const switchToBasic = () => {
    if (representable) applyBasicConversion();
    else setPendingSwitch(true);
  };

  return (
    <>
      {mode === 'basic' ? (
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
                  <span className={filterStyles.filterCount}>{conditions.length}</span>
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
            <RelationFilterBuilder
              conditions={conditions}
              onChange={setConditions}
              onClose={() => filterPopoverRef.current?.close()}
              relationSchemas={relationSchemas}
              entitySchemas={entitySchemas}
              enums={enums}
              owners={owners}
              lifecycleStates={lifecycleStates}
              getFieldGroupAccess={getFieldGroupAccess}
            />
          </Popover.Content>
        </Popover.Root>
      ) : (
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

      <Button
        size="sm"
        variant="secondary"
        onClick={mode === 'basic' ? switchToAdvanced : switchToBasic}
        title={mode === 'basic' ? 'Switch to advanced query mode' : 'Switch to basic query mode'}
      >
        {mode === 'basic' ? 'Advanced' : 'Basic'}
      </Button>

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
              applyBasicConversion();
              setPendingSwitch(false);
            }
          }
        ]}
      >
        <p>
          This query uses grouping or relation traversal that Basic mode can&apos;t represent.
          Switching will keep only the parts Basic mode supports and drop the rest.
        </p>
      </Dialog>
    </>
  );
};
