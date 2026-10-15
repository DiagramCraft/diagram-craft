import { EmptyState } from "../../../components/EmptyState";
import { LoadingState } from "../../../components/LoadingState";
import { useWorkspaceContext } from "../../../layouts/WorkspaceContext";
import { useNeedsAttentionQueue } from "../../data-views/needs-attention/needsAttentionQueue";
import { useWidgetBodyTitle } from "../../shared/dashboard/WidgetBodyTitle";
import { countDueWithin, renderCaseCountSubtext } from "./caseCountLogic";
import styles from "./CaseCount.module.css";
import { CaseCountWidgetConfig } from "./types";

const TONE_COLOR = {
  none: undefined,
  warning: "var(--cmp-fg-warning, #eab308)",
  danger: "var(--cmp-fg-danger, #ef4444)",
} as const;

/** Number of open governance cases against entities of one schema, e.g. awaiting a decision. */
export const CaseCountWidget = ({
  config,
}: {
  config: CaseCountWidgetConfig;
}) => {
  const title = useWidgetBodyTitle();
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaId =
    config.schema ||
    schemas.find((candidate) => candidate.name === config.schemaName)?.id ||
    null;
  const queue = useNeedsAttentionQueue(workspaceSlug, {
    schemaId,
    caseKinds: config.caseKinds,
    scope: config.scope,
  });

  if (schemaId == null) {
    return <EmptyState title="Choose an entity type for this widget" compact />;
  }
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;

  const count = queue.items.length;
  const due = countDueWithin(
    queue.items.map((item) => item.case),
    config.dueWithinDays,
  );
  return (
    <div className={styles.tile}>
      <div className={styles.label}>{title ?? "Cases"}</div>
      <div
        className={styles.value}
        style={
          count > 0 && TONE_COLOR[config.tone]
            ? { color: TONE_COLOR[config.tone] }
            : undefined
        }
      >
        {count}
      </div>
      <div className={styles.sub}>
        {renderCaseCountSubtext(config.subtextTemplate, count, due)}
      </div>
    </div>
  );
};
