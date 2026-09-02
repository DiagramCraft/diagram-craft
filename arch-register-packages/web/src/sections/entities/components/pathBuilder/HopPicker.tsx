import type { ReactNode } from 'react';
import { TbChevronDown } from 'react-icons/tb';
import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import { groupPathStepOptions, pathStepKey, type PathStepContext } from './pathBuilderState';
import styles from './pathBuilder.module.css';

/** The subset of `PathStepContext` (and its position-aware counterpart,
 *  `PositionedPathStepContext`, #3120) `HopPicker` actually needs - structural, so either context
 *  shape can be passed without a cast. */
type HopPickerStepContext = Pick<PathStepContext, 'direction' | 'options' | 'availableDirections'>;

type HopPickerProps = {
  step: PathStep;
  stepContext: HopPickerStepContext;
  ariaLabelDirection: string;
  ariaLabelHop: string;
  /** `targetSchemaIds` is the schema(s) the selected option resolves to (from the same
   *  `PathStepOption` the select/toggle just picked from) - callers that need to know which
   *  schema a hop landed on (Map, for level layout) can use it directly instead of re-deriving it
   *  themselves, which is what previously let the two drift out of sync (#3040-map). Callers that
   *  don't need it (Traceability) can ignore the second argument. */
  onChangeStep: (step: PathStep, targetSchemaIds?: string[]) => void;
  onToggleDirection: (direction: 'in' | 'out') => void;
  /** Hides the direction-toggle button entirely - for a hop at a relation position
   *  (`PositionedPathStepContext.hasDirectionToggle === false`, #3120), where `endpoint`/
   *  `relationForward` options have no in/out sense to toggle between. Defaults to shown, matching
   *  every existing entity-only caller. */
  hideDirectionToggle?: boolean;
  /** Slot for per-hop controls a specific caller needs (e.g. Map's per-level visibility toggle),
   *  rendered after the hop select. Keeps `HopPicker` itself free of caller-specific chrome so it
   *  stays reusable across views/use-cases beyond Traceability and Map. */
  renderExtra?: (ctx: { step: PathStep; stepContext: HopPickerStepContext }) => ReactNode;
};

/** Renders one hop: a direction-toggle button plus a grouped `<select>` of legal next hops for the
 *  current schema scope. Add/remove-hop chrome and error display are caller-owned. */
export const HopPicker = ({
  step,
  stepContext,
  ariaLabelDirection,
  ariaLabelHop,
  onChangeStep,
  onToggleDirection,
  hideDirectionToggle = false,
  renderExtra
}: HopPickerProps) => {
  const direction = stepContext.direction;
  const stepKey = pathStepKey(step);
  const selectedOption = stepContext.options.find(option => pathStepKey(option.step) === stepKey);
  const oppositeDirection = direction === 'in' ? 'out' : 'in';
  const canToggleDirection = stepContext.availableDirections.includes(oppositeDirection);

  return (
    <>
      {!hideDirectionToggle && (
        <button
          type="button"
          className={styles.hopDir}
          aria-label={ariaLabelDirection}
          title={
            canToggleDirection
              ? `Traversing ${direction} — click to reverse`
              : `Traversing ${direction}`
          }
          disabled={!canToggleDirection}
          onClick={() => onToggleDirection(oppositeDirection)}
        >
          {direction === 'in' ? '→' : '←'}
        </button>
      )}
      <div className={styles.selectWrap}>
        <select
          className={styles.select}
          value={stepKey}
          aria-label={ariaLabelHop}
          onChange={event => {
            const option = stepContext.options.find(
              candidate => pathStepKey(candidate.step) === event.target.value
            );
            if (option) onChangeStep(option.step, option.targetSchemaIds);
          }}
        >
          {selectedOption == null && (
            <option value={stepKey} disabled>
              {`Unavailable hop (${stepKey})`}
            </option>
          )}
          {groupPathStepOptions(stepContext.options).map(({ group, options }) => (
            <optgroup key={group} label={group}>
              {options.map(option => (
                <option key={pathStepKey(option.step)} value={pathStepKey(option.step)}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <TbChevronDown size={11} />
      </div>
      {renderExtra?.({ step, stepContext })}
    </>
  );
};
